#!/usr/bin/env python3
"""Enrich Sunbiz-matched HVAC leads with Google Places data without paid usage.

The script deliberately separates free-cap Text Search Pro calls from the more
expensive Place Details calls. It persists every result so reruns resume instead
of consuming the monthly allowance again.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DETAIL_URL = "https://places.googleapis.com/v1/places/{place_id}"
SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress"
DETAIL_FIELDS = ",".join(
    (
        "id",
        "displayName",
        "formattedAddress",
        "nationalPhoneNumber",
        "internationalPhoneNumber",
        "userRatingCount",
        "websiteUri",
        "businessStatus",
        "googleMapsUri",
    )
)
DEFAULT_INPUT = Path("data/leads/sunbiz/hvac_sunbiz_enriched.csv")
DEFAULT_OUTPUT = Path("data/leads/google_places")
FREE_TEXT_SEARCH_CAP = 5_000
FREE_DETAILS_CAP = 1_000
MATCH_THRESHOLD = 0.68
CONFIDENCE_ORDER = {
    "high_officer": 4,
    "high_entity": 3,
    "probable": 2,
    "ambiguous": 1,
    "unmatched": 0,
}
_write_lock = threading.Lock()


class PlacesError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"Google Places HTTP {status}: {message}")
        self.status = status


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode()
    text = text.upper().replace("&", " AND ")
    text = re.sub(r"\b(L\s*L\s*C|LLC|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LTD)\b", " ", text)
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", text)).strip()


def env_value(path: Path, names: tuple[str, ...]) -> str:
    for name in names:
        if os.environ.get(name):
            return os.environ[name].strip()
    if path.exists():
        for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() in names:
                return value.strip().strip('"').strip("'")
    return ""


def request_json(
    url: str,
    api_key: str,
    fields: str,
    payload: dict[str, Any] | None = None,
    timeout: float = 20.0,
) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(url, data=body, method="GET" if body is None else "POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("X-Goog-Api-Key", api_key)
    request.add_header("X-Goog-FieldMask", fields)
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")[:500]
        raise PlacesError(exc.code, message) from exc
    except URLError as exc:
        raise RuntimeError(f"Google Places connection failed: {exc.reason}") from exc


def lead_key(row: dict[str, str]) -> str:
    return clean(row.get("dbpr_license_number")) or clean(row.get("sunbiz_document_number"))


def query_for(row: dict[str, str]) -> str:
    business = (
        clean(row.get("sunbiz_entity_name"))
        or clean(row.get("dba_business_name"))
        or clean(row.get("contractor_name"))
    )
    location = " ".join(
        part for part in (clean(row.get("business_address")), clean(row.get("city")), "FL") if part
    )
    return f"{business} {location}".strip()


def place_score(row: dict[str, str], place: dict[str, Any]) -> float:
    target_name = normalize(
        row.get("sunbiz_entity_name") or row.get("dba_business_name") or row.get("contractor_name")
    )
    place_name = normalize(place.get("displayName", {}).get("text", ""))
    if not target_name or not place_name:
        return 0.0
    score = 0.72 * SequenceMatcher(None, target_name, place_name).ratio()
    address = normalize(place.get("formattedAddress", ""))
    city = normalize(row.get("city"))
    zip5 = clean(row.get("zip"))[:5]
    street_number = re.match(r"\d+", clean(row.get("business_address")))
    if city and city in address:
        score += 0.10
    if zip5 and zip5 in address:
        score += 0.13
    if street_number and re.search(rf"\b{re.escape(street_number.group())}\b", address):
        score += 0.05
    return round(min(score, 1.0), 4)


def select_place(row: dict[str, str], places: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    ranked = sorted(((place_score(row, place), place) for place in places), reverse=True, key=lambda item: item[0])
    if not ranked or ranked[0][0] < MATCH_THRESHOLD:
        return None, ranked[0][0] if ranked else 0.0
    return ranked[0][1], ranked[0][0]


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _write_lock, path.open("a", encoding="utf-8", newline="") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
        handle.flush()


def load_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return records
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path} at line {line_number}") from exc
            records[record["lead_key"]] = record
    return records


def search_one(row: dict[str, str], api_key: str) -> dict[str, Any]:
    key = lead_key(row)
    try:
        response = request_json(
            SEARCH_URL,
            api_key,
            SEARCH_FIELDS,
            {"textQuery": query_for(row), "pageSize": 5, "languageCode": "en", "regionCode": "US"},
        )
        selected, score = select_place(row, response.get("places", []))
        return {
            "lead_key": key,
            "query": query_for(row),
            "match_score": score,
            "place": selected,
            "status": "matched" if selected else "no_confident_match",
        }
    except Exception as exc:  # persisted for audit; retryable errors are retried on the next invocation
        return {"lead_key": key, "query": query_for(row), "status": "error", "error": str(exc)}


def run_searches(
    rows: list[dict[str, str]], api_key: str, cache_path: Path, cap: int, workers: int
) -> dict[str, dict[str, Any]]:
    cached = load_jsonl(cache_path)
    pending = [row for row in rows if lead_key(row) and lead_key(row) not in cached]
    allowance = max(0, cap - len(cached))
    pending = pending[:allowance]
    if pending:
        print(f"Searching Google Places for {len(pending)} leads ({len(cached)} cached)...", flush=True)
    completed = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(search_one, row, api_key): row for row in pending}
        for future in as_completed(futures):
            record = future.result()
            append_jsonl(cache_path, record)
            cached[record["lead_key"]] = record
            completed += 1
            if completed % 100 == 0:
                print(f"  Text Search progress: {completed}/{len(pending)}", flush=True)
    return cached


def read_usage(path: Path) -> int:
    if not path.exists():
        return 0
    return int(json.loads(path.read_text(encoding="utf-8")).get("detail_attempts", 0))


def write_usage(path: Path, attempts: int) -> None:
    path.write_text(
        json.dumps(
            {
                "month_utc": datetime.now(timezone.utc).strftime("%Y-%m"),
                "detail_attempts": attempts,
                "hard_cap": FREE_DETAILS_CAP,
                "updated_at_utc": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def ranked_matches(
    rows: list[dict[str, str]], searches: dict[str, dict[str, Any]]
) -> list[tuple[dict[str, str], dict[str, Any]]]:
    matched = []
    for row in rows:
        search = searches.get(lead_key(row), {})
        if search.get("status") == "matched" and search.get("place", {}).get("id"):
            matched.append((row, search))
    return sorted(
        matched,
        key=lambda item: (
            CONFIDENCE_ORDER.get(clean(item[0].get("sunbiz_match_confidence")), 0),
            float(item[1].get("match_score", 0)),
        ),
        reverse=True,
    )


def run_details(
    ranked: list[tuple[dict[str, str], dict[str, Any]]],
    api_key: str,
    cache_path: Path,
    usage_path: Path,
    cap: int,
) -> dict[str, dict[str, Any]]:
    cached = load_jsonl(cache_path)
    attempts = read_usage(usage_path)
    available = max(0, min(cap, FREE_DETAILS_CAP) - attempts)
    pending = [(row, search) for row, search in ranked if lead_key(row) not in cached][:available]
    print(
        f"Place Details free-cap allowance: {available}; requesting {len(pending)} "
        f"({attempts} already attempted this month).",
        flush=True,
    )
    for index, (row, search) in enumerate(pending, 1):
        key = lead_key(row)
        place_id = search["place"]["id"]
        attempts += 1
        write_usage(usage_path, attempts)  # reserve before the network call; crashes cannot double-spend
        try:
            details = request_json(DETAIL_URL.format(place_id=quote(place_id, safe="")), api_key, DETAIL_FIELDS)
            record = {"lead_key": key, "status": "enriched", "details": details}
        except Exception as exc:
            record = {"lead_key": key, "status": "error", "place_id": place_id, "error": str(exc)}
        append_jsonl(cache_path, record)
        cached[key] = record
        if index % 50 == 0:
            print(f"  Place Details progress: {index}/{len(pending)}", flush=True)
        if "HTTP 429" in record.get("error", ""):
            print("Google returned HTTP 429; stopping before further requests.", flush=True)
            break
        time.sleep(0.02)
    return cached


def merge_output(
    rows: list[dict[str, str]],
    fields: list[str],
    searches: dict[str, dict[str, Any]],
    details: dict[str, dict[str, Any]],
    output_path: Path,
) -> dict[str, int]:
    extra_fields = [
        "google_place_match_score",
        "google_business_status",
        "google_website_uri",
        "google_enrichment_status",
    ]
    output_fields = fields + [field for field in extra_fields if field not in fields]
    counts = {"rows": len(rows), "search_matches": 0, "details_enriched": 0, "phones_found": 0}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fields, extrasaction="ignore")
        writer.writeheader()
        for source in rows:
            row = dict(source)
            key = lead_key(row)
            search = searches.get(key, {})
            place = search.get("place") or {}
            if place:
                counts["search_matches"] += 1
                row["google_business_profile_name"] = place.get("displayName", {}).get("text", "")
                row["google_business_profile_url_or_place_id"] = place.get("id", "")
                row["google_place_match_score"] = search.get("match_score", "")
            detail_record = details.get(key, {})
            payload = detail_record.get("details") or {}
            if payload:
                counts["details_enriched"] += 1
                phone = payload.get("nationalPhoneNumber") or payload.get("internationalPhoneNumber") or ""
                row["verified_business_phone"] = phone
                row["google_review_count"] = payload.get("userRatingCount", "")
                row["google_business_profile_name"] = payload.get("displayName", {}).get("text", row.get("google_business_profile_name", ""))
                row["google_business_profile_url_or_place_id"] = payload.get("googleMapsUri") or payload.get("id", "")
                row["google_business_status"] = payload.get("businessStatus", "")
                row["google_website_uri"] = payload.get("websiteUri", "")
                row["google_enrichment_status"] = "phone_found" if phone else "matched_no_phone"
                if phone:
                    counts["phones_found"] += 1
                maps_uri = payload.get("googleMapsUri", "")
                if maps_uri:
                    evidence = [item for item in clean(row.get("evidence_source_urls")).split(" | ") if item]
                    if maps_uri not in evidence:
                        evidence.append(maps_uri)
                    row["evidence_source_urls"] = " | ".join(evidence)
            elif search.get("status"):
                row["google_enrichment_status"] = search["status"]
            writer.writerow(row)
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--search-cap", type=int, default=FREE_TEXT_SEARCH_CAP)
    parser.add_argument("--details-cap", type=int, default=FREE_DETAILS_CAP)
    parser.add_argument("--workers", type=int, default=8)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.search_cap > FREE_TEXT_SEARCH_CAP or args.details_cap > FREE_DETAILS_CAP:
        raise SystemExit("Refusing caps above Google's monthly free usage caps.")
    api_key = env_value(args.env_file, ("GOOGLE_MAPS_API_KEY", "GOOGLE_PLACES_API_KEY"))
    if not api_key:
        raise SystemExit("GOOGLE_MAPS_API_KEY is missing from the environment or .env.local")
    if not args.input.exists():
        raise SystemExit(f"Input not found: {args.input}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with args.input.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = list(reader.fieldnames or [])
        rows = list(reader)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    search_cache = args.output_dir / "google_text_search_cache.jsonl"
    detail_cache = args.output_dir / f"google_place_details_{month}.jsonl"
    usage_path = args.output_dir / f"google_free_cap_usage_{month}.json"
    searches = run_searches(rows, api_key, search_cache, args.search_cap, args.workers)
    ranked = ranked_matches(rows, searches)
    details = run_details(ranked, api_key, detail_cache, usage_path, args.details_cap)
    output_path = args.output_dir / "hvac_google_places_enriched.csv"
    summary = merge_output(rows, fields, searches, details, output_path)
    summary.update(
        {
            "month_utc": month,
            "text_search_attempts_cached": len(searches),
            "confident_google_matches": len(ranked),
            "place_detail_attempts_reserved": read_usage(usage_path),
            "free_text_search_cap": FREE_TEXT_SEARCH_CAP,
            "free_place_details_cap": FREE_DETAILS_CAP,
            "output": str(output_path.resolve()),
        }
    )
    summary_path = args.output_dir / "hvac_google_places_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
