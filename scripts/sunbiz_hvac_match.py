#!/usr/bin/env python3
"""Stream Sunbiz cordata files and reconcile them with DBPR HVAC candidates."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from zipfile import ZipFile

try:
    import pandas as pd
    from rapidfuzz import fuzz
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "pandas and RapidFuzz are required. Install dependencies with: "
        "python -m pip install -r scripts/requirements-dbpr-hvac.txt"
    ) from exc

RECORD_LENGTH = 1440
SUNBIZ_SEARCH_URL = "https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber"
NON_ALNUM = re.compile(r"[^A-Z0-9]+")
SPACES = re.compile(r"\s+")
LEGAL_SUFFIXES = {
    "LLC", "LC", "PLLC", "LLP", "LP", "LTD", "LIMITED", "INC", "INCORPORATED",
    "CORP", "CORPORATION", "CO", "COMPANY", "PA", "PC",
}
GENERIC_TOKENS = LEGAL_SUFFIXES | {
    "AIR", "AC", "A", "CONDITIONING", "HEATING", "COOLING", "HVAC", "MECHANICAL",
    "SERVICE", "SERVICES", "SOLUTIONS", "SYSTEM", "SYSTEMS", "FLORIDA", "OF", "THE",
    "AND", "CONTRACTING", "CONTRACTOR", "ENTERPRISES", "GROUP",
}
PERSON_SUFFIXES = {"JR", "SR", "II", "III", "IV", "V"}
OFFICER_STARTS = (668, 796, 924, 1052, 1180, 1308)  # zero-based title positions


@dataclass(frozen=True)
class Candidate:
    index: int
    business_name: str
    normalized_business_name: str
    canonical_business_name: str
    contractor_name: str
    person_key: str
    address: str
    normalized_address: str
    city: str
    zip5: str


@dataclass(frozen=True)
class Entity:
    document_number: str
    name: str
    normalized_name: str
    canonical_name: str
    status: str
    filing_type: str
    address: str
    normalized_address: str
    city: str
    normalized_city: str
    state: str
    zip5: str
    file_date: str
    officers: tuple[tuple[str, str, str], ...]  # title, name, person key


@dataclass(frozen=True)
class Match:
    candidate_index: int
    document_number: str
    entity_name: str
    entity_status: str
    filing_type: str
    file_date: str
    entity_address: str
    entity_city: str
    entity_state: str
    entity_zip: str
    name_similarity: float
    address_similarity: float
    city_match: bool
    zip_match: bool
    officer_match: str
    officer_title: str
    score: float
    confidence: str


def fast_normalize(raw: bytes | str) -> str:
    if isinstance(raw, bytes):
        text = raw.decode("cp1252", errors="replace")
    else:
        text = raw
    text = text.upper().replace("&", " AND ")
    return SPACES.sub(" ", NON_ALNUM.sub(" ", text)).strip()


def canonical_business_name(value: bytes | str) -> str:
    normalized = fast_normalize(value)
    tokens = normalized.split()
    if len(tokens) >= 3 and tokens[-3:] == ["L", "L", "C"]:
        tokens = tokens[:-3]
    while tokens and tokens[-1] in LEGAL_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def person_key(value: bytes | str) -> str:
    tokens = [
        token
        for token in fast_normalize(value).split()
        if len(token) > 1 and token not in PERSON_SUFFIXES
    ]
    if len(tokens) < 2:
        return ""
    return " ".join(sorted(tokens))


def _text(line: bytes, start: int, length: int) -> str:
    return line[start : start + length].decode("cp1252", errors="replace").strip()


def parse_entity(line: bytes, include_officers: bool = True) -> Entity:
    if len(line) != RECORD_LENGTH:
        raise ValueError(f"Expected a {RECORD_LENGTH}-byte record, got {len(line)} bytes")
    name = _text(line, 12, 192)
    address_1 = _text(line, 220, 42)
    address_2 = _text(line, 262, 42)
    address = ", ".join(part for part in (address_1, address_2) if part)
    file_date_raw = _text(line, 472, 8)
    file_date = ""
    if re.fullmatch(r"\d{8}", file_date_raw):
        file_date = f"{file_date_raw[4:8]}-{file_date_raw[:2]}-{file_date_raw[2:4]}"
    officers: list[tuple[str, str, str]] = []
    if include_officers:
        for start in OFFICER_STARTS:
            title = _text(line, start, 4)
            officer_type = _text(line, start + 4, 1)
            officer_name = _text(line, start + 5, 42)
            key = person_key(officer_name) if officer_type == "P" and officer_name else ""
            if key:
                officers.append((title, officer_name, key))
    return Entity(
        document_number=_text(line, 0, 12),
        name=name,
        normalized_name=fast_normalize(name),
        canonical_name=canonical_business_name(name),
        status=_text(line, 204, 1),
        filing_type=_text(line, 205, 15),
        address=address,
        normalized_address=fast_normalize(address),
        city=_text(line, 304, 28),
        normalized_city=fast_normalize(_text(line, 304, 28)),
        state=_text(line, 332, 2),
        zip5=_text(line, 334, 10)[:5],
        file_date=file_date,
        officers=tuple(officers),
    )


def load_candidates(path: Path) -> tuple[pd.DataFrame, list[Candidate]]:
    if not path.is_file():
        raise FileNotFoundError(f"Candidate CSV not found: {path}")
    frame = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    required = {
        "dba_business_name", "contractor_name", "business_address", "city", "zip",
    }
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Candidate CSV is missing required columns: {', '.join(missing)}")
    candidates = []
    for index, row in frame.iterrows():
        business_name = str(row["dba_business_name"]).strip()
        contractor_name = str(row["contractor_name"]).strip()
        address = str(row["business_address"]).strip()
        candidates.append(
            Candidate(
                index=int(index),
                business_name=business_name,
                normalized_business_name=fast_normalize(business_name),
                canonical_business_name=canonical_business_name(business_name),
                contractor_name=contractor_name,
                person_key=person_key(contractor_name),
                address=address,
                normalized_address=fast_normalize(address),
                city=fast_normalize(str(row["city"])),
                zip5=re.sub(r"\D", "", str(row["zip"]))[:5],
            )
        )
    return frame, candidates


def build_indexes(candidates: list[Candidate]) -> dict[str, object]:
    normalized_names: dict[str, set[int]] = defaultdict(set)
    canonical_names: dict[str, set[int]] = defaultdict(set)
    people: dict[str, set[int]] = defaultdict(set)
    person_parts: dict[tuple[bytes, bytes], set[int]] = defaultdict(set)
    token_frequency: Counter[str] = Counter()
    for candidate in candidates:
        if candidate.normalized_business_name:
            normalized_names[candidate.normalized_business_name].add(candidate.index)
        if candidate.canonical_business_name:
            canonical_names[candidate.canonical_business_name].add(candidate.index)
            token_frequency.update(set(candidate.canonical_business_name.split()) - GENERIC_TOKENS)
        if candidate.person_key:
            people[candidate.person_key].add(candidate.index)
        if "," in candidate.contractor_name:
            last, remainder = candidate.contractor_name.split(",", 1)
            first_tokens = fast_normalize(remainder).split()
            last_bytes = last.strip().upper().encode("cp1252", errors="ignore")
            first_bytes = first_tokens[0].encode("cp1252", errors="ignore") if first_tokens else b""
            if last_bytes and first_bytes:
                person_parts[(last_bytes, first_bytes)].add(candidate.index)

    tokens: dict[str, set[int]] = defaultdict(set)
    for candidate in candidates:
        for token in set(candidate.canonical_business_name.split()) - GENERIC_TOKENS:
            if len(token) >= 3 and token_frequency[token] <= 20:
                tokens[token].add(candidate.index)
    return {
        "normalized_names": normalized_names,
        "canonical_names": canonical_names,
        "people": people,
        "person_parts": person_parts,
        "tokens": tokens,
    }


def fast_officer_candidates(
    line: bytes, indexes: dict[str, object]
) -> dict[int, tuple[str, str]]:
    """Use Sunbiz's observed LAST(20)+FIRST layout to avoid decoding every officer."""
    found: dict[int, tuple[str, str]] = {}
    person_parts = indexes["person_parts"]
    for start in OFFICER_STARTS:
        if line[start + 4 : start + 5] != b"P":
            continue
        raw_name = line[start + 5 : start + 47]
        last = raw_name[:20].strip().upper()
        if not last:
            continue
        first_fields = raw_name[20:].strip().upper().split(maxsplit=1)
        if not first_fields:
            continue
        candidate_ids = person_parts.get((last, first_fields[0]), ())
        if not candidate_ids:
            continue
        title = _text(line, start, 4)
        name = raw_name.decode("cp1252", errors="replace").strip()
        for candidate_id in candidate_ids:
            found.setdefault(candidate_id, (title, name))
    return found


def candidate_ids_for_entity(entity: Entity, indexes: dict[str, object]) -> tuple[set[int], dict[int, tuple[str, str]]]:
    ids: set[int] = set()
    officer_matches: dict[int, tuple[str, str]] = {}
    ids.update(indexes["normalized_names"].get(entity.normalized_name, ()))
    ids.update(indexes["canonical_names"].get(entity.canonical_name, ()))
    for token in set(entity.canonical_name.split()) - GENERIC_TOKENS:
        ids.update(indexes["tokens"].get(token, ()))
    if entity.status == "A":
        for title, officer_name, key in entity.officers:
            for candidate_id in indexes["people"].get(key, ()):
                ids.add(candidate_id)
                officer_matches.setdefault(candidate_id, (title, officer_name))
    return ids, officer_matches


def score_match(candidate: Candidate, entity: Entity, officer: tuple[str, str] | None) -> Match | None:
    if candidate.normalized_business_name == entity.normalized_name:
        name_similarity = 100.0
        name_points = 60
    elif candidate.canonical_business_name == entity.canonical_name:
        name_similarity = 100.0
        name_points = 55
    else:
        name_similarity = float(
            fuzz.WRatio(candidate.canonical_business_name, entity.canonical_name)
        )
        if name_similarity >= 97:
            name_points = 50
        elif name_similarity >= 93:
            name_points = 45
        elif name_similarity >= 88:
            name_points = 36
        elif name_similarity >= 83:
            name_points = 28
        else:
            name_points = 0

    zip_match = bool(candidate.zip5 and candidate.zip5 == entity.zip5)
    city_match = bool(candidate.city and candidate.city == entity.normalized_city)
    address_similarity = 0.0
    address_points = 0
    if candidate.normalized_address and entity.normalized_address:
        address_similarity = float(
            fuzz.WRatio(candidate.normalized_address, entity.normalized_address)
        )
        candidate_number = candidate.normalized_address.split()[0]
        entity_number = entity.normalized_address.split()[0]
        if candidate.normalized_address == entity.normalized_address:
            address_points = 20
        elif candidate_number.isdigit() and candidate_number == entity_number and address_similarity >= 80:
            address_points = 14
        elif address_similarity >= 92:
            address_points = 10

    location_points = (10 if zip_match else 0) + (8 if city_match else 0) + address_points
    officer_points = 35 if officer else 0
    score = name_points + location_points + officer_points
    if entity.status != "A":
        score -= 12
    score = max(0.0, min(100.0, float(score)))

    if not officer and name_similarity < 83:
        return None
    if officer and name_similarity < 70 and location_points < 10:
        return None
    if score < 45:
        return None

    if entity.status == "A" and officer and score >= 75 and (
        name_similarity >= 85 or address_similarity >= 85 or (zip_match and city_match)
    ):
        confidence = "high_officer"
    elif entity.status == "A" and name_similarity >= 95 and score >= 65 and (
        zip_match or city_match or address_similarity >= 85
    ):
        confidence = "high_entity"
    elif entity.status == "A" and score >= 65:
        confidence = "probable"
    else:
        confidence = "ambiguous"

    return Match(
        candidate_index=candidate.index,
        document_number=entity.document_number,
        entity_name=entity.name,
        entity_status="Active" if entity.status == "A" else "Inactive",
        filing_type=entity.filing_type,
        file_date=entity.file_date,
        entity_address=entity.address,
        entity_city=entity.city,
        entity_state=entity.state,
        entity_zip=entity.zip5,
        name_similarity=name_similarity,
        address_similarity=address_similarity,
        city_match=city_match,
        zip_match=zip_match,
        officer_match=officer[1] if officer else "",
        officer_title=officer[0] if officer else "",
        score=score,
        confidence=confidence,
    )


def iter_sources(path: Path) -> Iterable[tuple[str, Iterable[bytes]]]:
    if path.is_dir():
        files = sorted(path.glob("cordata*.txt"))
        if not files:
            raise FileNotFoundError(f"No cordata*.txt files found in {path}")
        for file_path in files:
            handle = file_path.open("rb", buffering=8 * 1024 * 1024)
            try:
                yield file_path.name, handle
            finally:
                handle.close()
        return
    if path.is_file() and path.suffix.lower() == ".txt":
        handle = path.open("rb", buffering=8 * 1024 * 1024)
        try:
            yield path.name, handle
        finally:
            handle.close()
        return
    if path.is_file() and path.suffix.lower() == ".zip":
        with ZipFile(path) as archive:
            names = sorted(name for name in archive.namelist() if Path(name).name.lower().startswith("cordata"))
            if not names:
                raise FileNotFoundError(f"No cordata entries found in {path}")
            for name in names:
                with archive.open(name) as handle:
                    yield name, handle
        return
    raise FileNotFoundError(f"--cordata must be a cordata directory, .txt file, or .zip file: {path}")


def scan_cordata(
    source: Path,
    candidates: list[Candidate],
    max_matches: int = 5,
) -> tuple[dict[int, list[Match]], dict[str, object]]:
    indexes = build_indexes(candidates)
    candidate_by_id = {candidate.index: candidate for candidate in candidates}
    matches: dict[int, list[Match]] = defaultdict(list)
    total_records = 0
    malformed_records = 0
    files_processed = 0
    started = time.perf_counter()

    for source_name, lines in iter_sources(source):
        file_records = 0
        file_matches = 0
        for raw_line in lines:
            line = raw_line.rstrip(b"\r\n")
            total_records += 1
            file_records += 1
            if len(line) != RECORD_LENGTH:
                malformed_records += 1
                continue
            name = _text(line, 12, 192)
            normalized_name = fast_normalize(name)
            canonical_name = canonical_business_name(name)
            candidate_ids: set[int] = set(indexes["normalized_names"].get(normalized_name, ()))
            candidate_ids.update(indexes["canonical_names"].get(canonical_name, ()))

            # Fuzzy comparison is limited to distinctive-token blocks and checked
            # against cheap location fields before the full record is decoded.
            token_ids: set[int] = set()
            for token in set(canonical_name.split()) - GENERIC_TOKENS:
                token_ids.update(indexes["tokens"].get(token, ()))
            if token_ids:
                entity_zip = _text(line, 334, 10)[:5]
                entity_city = fast_normalize(_text(line, 304, 28))
                for candidate_id in token_ids:
                    candidate = candidate_by_id[candidate_id]
                    similarity = fuzz.WRatio(candidate.canonical_business_name, canonical_name)
                    same_location = (
                        (candidate.zip5 and candidate.zip5 == entity_zip)
                        or (candidate.city and candidate.city == entity_city)
                    )
                    if similarity >= 88 or (similarity >= 83 and same_location):
                        candidate_ids.add(candidate_id)

            officer_matches: dict[int, tuple[str, str]] = {}
            if line[204:205] == b"A":
                officer_matches = fast_officer_candidates(line, indexes)
                candidate_ids.update(officer_matches)
            if not candidate_ids:
                continue

            entity = parse_entity(line, include_officers=True)
            # The general person-key comparison handles punctuation or spacing
            # variants for records already blocked by entity name/location.
            for title, officer_name, key in entity.officers:
                for candidate_id in indexes["people"].get(key, ()):
                    if candidate_id in candidate_ids:
                        officer_matches.setdefault(candidate_id, (title, officer_name))
            for candidate_id in candidate_ids:
                match = score_match(
                    candidate_by_id[candidate_id], entity, officer_matches.get(candidate_id)
                )
                if match is None:
                    continue
                matches[candidate_id].append(match)
                matches[candidate_id].sort(key=match_sort_key, reverse=True)
                del matches[candidate_id][max_matches:]
                file_matches += 1
        files_processed += 1
        print(
            f"Scanned {source_name}: {file_records:,} records, "
            f"{file_matches:,} candidate matches ({time.perf_counter() - started:.1f}s)",
            flush=True,
        )

    stats = {
        "source": str(source.resolve()),
        "files_processed": files_processed,
        "total_sunbiz_records_processed": total_records,
        "malformed_records": malformed_records,
        "processing_duration_seconds": round(time.perf_counter() - started, 3),
    }
    return matches, stats


def match_sort_key(match: Match) -> tuple[int, int, float, float, float]:
    confidence_rank = {"ambiguous": 1, "probable": 2, "high_entity": 3, "high_officer": 4}
    return (
        confidence_rank[match.confidence],
        1 if match.entity_status == "Active" else 0,
        match.score,
        match.name_similarity,
        match.address_similarity,
    )


def apply_matches(
    frame: pd.DataFrame,
    matches: dict[int, list[Match]],
    output_dir: Path,
    stats: dict[str, object],
) -> dict[str, object]:
    enriched = frame.copy()
    extra_columns = [
        "sunbiz_status", "sunbiz_filing_type", "sunbiz_file_date", "sunbiz_address",
        "sunbiz_city", "sunbiz_state", "sunbiz_zip", "sunbiz_match_score",
        "sunbiz_match_confidence", "sunbiz_name_similarity", "sunbiz_address_similarity",
        "sunbiz_officer_title", "sunbiz_alternative_count",
    ]
    for column in extra_columns:
        if column not in enriched:
            enriched[column] = ""

    alternatives: list[dict[str, object]] = []
    confidence_counts: Counter[str] = Counter()
    officer_match_count = 0
    for index in enriched.index:
        candidate_matches = matches.get(int(index), [])
        if not candidate_matches:
            enriched.at[index, "research_status"] = "No Sunbiz match in quarterly snapshot"
            confidence_counts["unmatched"] += 1
            continue
        best = candidate_matches[0]
        confidence_counts[best.confidence] += 1
        enriched.at[index, "sunbiz_entity_name"] = best.entity_name
        enriched.at[index, "sunbiz_document_number"] = best.document_number
        enriched.at[index, "sunbiz_status"] = best.entity_status
        enriched.at[index, "sunbiz_filing_type"] = best.filing_type
        enriched.at[index, "sunbiz_file_date"] = best.file_date
        enriched.at[index, "sunbiz_address"] = best.entity_address
        enriched.at[index, "sunbiz_city"] = best.entity_city
        enriched.at[index, "sunbiz_state"] = best.entity_state
        enriched.at[index, "sunbiz_zip"] = best.entity_zip
        enriched.at[index, "sunbiz_match_score"] = f"{best.score:.1f}"
        enriched.at[index, "sunbiz_match_confidence"] = best.confidence
        enriched.at[index, "sunbiz_name_similarity"] = f"{best.name_similarity:.1f}"
        enriched.at[index, "sunbiz_address_similarity"] = f"{best.address_similarity:.1f}"
        enriched.at[index, "sunbiz_alternative_count"] = str(max(0, len(candidate_matches) - 1))
        enriched.at[index, "evidence_source_urls"] = SUNBIZ_SEARCH_URL
        if best.officer_match:
            officer_match_count += 1
            enriched.at[index, "sunbiz_officer_manager_match"] = (
                f"{best.officer_title}: {best.officer_match}".strip(": ")
            )
            enriched.at[index, "sunbiz_officer_title"] = best.officer_title
            enriched.at[index, "ownership_verification_status"] = (
                "Officer/manager name match; ownership not independently proven"
            )
        else:
            enriched.at[index, "ownership_verification_status"] = "Not verified"

        status_by_confidence = {
            "high_officer": "Strong Sunbiz entity and officer/manager match",
            "high_entity": "Strong Sunbiz entity match; officer/manager not matched",
            "probable": "Probable Sunbiz match; review required",
            "ambiguous": "Ambiguous Sunbiz match; review required",
        }
        enriched.at[index, "research_status"] = status_by_confidence[best.confidence]
        enriched.at[index, "match_confidence"] = best.confidence

        for rank, match in enumerate(candidate_matches, start=1):
            alternatives.append(
                {
                    "candidate_row": int(index) + 2,
                    "dbpr_license_number": enriched.at[index, "dbpr_license_number"],
                    "dba_business_name": enriched.at[index, "dba_business_name"],
                    "contractor_name": enriched.at[index, "contractor_name"],
                    "match_rank": rank,
                    **match.__dict__,
                    "evidence_url": SUNBIZ_SEARCH_URL,
                }
            )

    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "hvac_sunbiz_enriched.csv"
    review_path = output_dir / "hvac_sunbiz_needs_review.csv"
    alternatives_path = output_dir / "hvac_sunbiz_match_alternatives.csv"
    summary_path = output_dir / "hvac_sunbiz_summary.json"
    enriched.to_csv(enriched_path, index=False, encoding="utf-8-sig")
    review = enriched.loc[enriched["sunbiz_match_confidence"].ne("high_officer")]
    review.to_csv(review_path, index=False, encoding="utf-8-sig")
    pd.DataFrame(alternatives).to_csv(alternatives_path, index=False, encoding="utf-8-sig")

    summary = {
        **stats,
        "candidate_records": len(enriched),
        "best_match_counts": dict(sorted(confidence_counts.items())),
        "officer_manager_name_matches": officer_match_count,
        "records_requiring_review": len(review),
        "total_retained_match_alternatives": len(alternatives),
        "outputs": {
            "enriched": str(enriched_path.resolve()),
            "needs_review": str(review_path.resolve()),
            "alternatives": str(alternatives_path.resolve()),
        },
        "ownership_caution": (
            "An officer, manager, registered-agent, or name match is not by itself proof of ownership."
        ),
    }
    with summary_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Stream Sunbiz cordata and reconcile entities/officers to DBPR HVAC candidates."
    )
    parser.add_argument("--candidates", required=True, type=Path, help="DBPR candidate CSV")
    parser.add_argument(
        "--cordata", required=True, type=Path, help="cordata directory, one cordata .txt, or cordata.zip"
    )
    parser.add_argument("--output", required=True, type=Path, help="Output directory")
    parser.add_argument(
        "--max-matches", type=int, default=5, help="Maximum retained Sunbiz alternatives per candidate"
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.max_matches < 1:
        parser.error("--max-matches must be at least 1")
    try:
        frame, candidates = load_candidates(args.candidates)
        print(f"Loaded {len(candidates):,} HVAC candidates.", flush=True)
        matches, stats = scan_cordata(args.cordata, candidates, args.max_matches)
        summary = apply_matches(frame, matches, args.output, stats)
    except (FileNotFoundError, ValueError) as exc:
        parser.exit(2, f"error: {exc}\n")
    counts = summary["best_match_counts"]
    print(f"Sunbiz records processed: {summary['total_sunbiz_records_processed']:,}")
    print(f"High entity + officer matches: {counts.get('high_officer', 0):,}")
    print(f"High entity-only matches: {counts.get('high_entity', 0):,}")
    print(f"Probable matches: {counts.get('probable', 0):,}")
    print(f"Ambiguous matches: {counts.get('ambiguous', 0):,}")
    print(f"Unmatched: {counts.get('unmatched', 0):,}")
    print(f"Processing time: {summary['processing_duration_seconds']:.3f} seconds")
    print(f"Outputs: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
