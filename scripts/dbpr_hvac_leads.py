#!/usr/bin/env python3
"""Build prioritized Florida HVAC lead cohorts from the DBPR license extract."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Sequence

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover - exercised by users without deps
    raise SystemExit(
        "pandas is required. Install dependencies with: "
        "python -m pip install -r scripts/requirements-dbpr-hvac.txt"
    ) from exc


OFFICIAL_FIELDS = [
    "board_number",
    "occupation_code",
    "licensee_name",
    "doing_business_as_name",
    "class_code",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "zip",
    "county_code",
    "license_number",
    "primary_status",
    "secondary_status",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "blank",
    "renewal_period",
    "alternate_license_number",
]
EXTRA_FIELD = "extra_trailing_blank"
HVAC_CODES = {"CAC", "CMC", "RA", "RM"}
HVAC_DESCRIPTIONS = {
    "CAC": "Certified Air Conditioning",
    "CMC": "Certified Mechanical",
    "RA": "Registered Air Conditioning",
    "RM": "Registered Mechanical",
}
COUNTIES = {
    "11": "Alachua", "12": "Baker", "13": "Bay", "14": "Bradford",
    "15": "Brevard", "16": "Broward", "17": "Calhoun", "18": "Charlotte",
    "19": "Citrus", "20": "Clay", "21": "Collier", "22": "Columbia",
    "23": "Miami-Dade", "24": "DeSoto", "25": "Dixie", "26": "Duval",
    "27": "Escambia", "28": "Flagler", "29": "Franklin", "30": "Gadsden",
    "31": "Gilchrist", "32": "Glades", "33": "Gulf", "34": "Hamilton",
    "35": "Hardee", "36": "Hendry", "37": "Hernando", "38": "Highlands",
    "39": "Hillsborough", "40": "Holmes", "41": "Indian River", "42": "Jackson",
    "43": "Jefferson", "44": "Lafayette", "45": "Lake", "46": "Lee",
    "47": "Leon", "48": "Levy", "49": "Liberty", "50": "Madison",
    "51": "Manatee", "52": "Marion", "53": "Martin", "54": "Monroe",
    "55": "Nassau", "56": "Okaloosa", "57": "Okeechobee", "58": "Orange",
    "59": "Osceola", "60": "Palm Beach", "61": "Pasco", "62": "Pinellas",
    "63": "Polk", "64": "Putnam", "65": "St. Johns", "66": "St. Lucie",
    "67": "Santa Rosa", "68": "Sarasota", "69": "Seminole", "70": "Sumter",
    "71": "Suwannee", "72": "Taylor", "73": "Union", "74": "Volusia",
    "75": "Wakulla", "76": "Walton", "77": "Washington", "78": "Unknown",
    "79": "Out of State", "80": "Foreign", "99": "Unknown",
}
PRIMARY_STATUS = {"C": "Current", "P": "Probation", "S": "Suspended"}
SECONDARY_STATUS = {"A": "Active", "I": "Inactive"}
OUTPUT_FILES = {
    "tier_1": "hvac_0_365_days.csv",
    "tier_2": "hvac_366_730_days.csv",
    "tier_3": "hvac_731_1095_days.csv",
    "verification": "hvac_needs_verification.csv",
    "summary": "hvac_pipeline_summary.json",
}

ENRICHED_COLUMNS = [
    "contractor_name",
    "dbpr_license_number",
    "license_type",
    "original_license_date",
    "license_age_days",
    "license_status",
    "dba_business_name",
    "city",
    "county",
    "state",
    "zip",
    "business_address",
    "normalized_contractor_name",
    "normalized_business_name",
    "normalized_license_number",
    "normalized_business_address",
    "sunbiz_entity_name",
    "sunbiz_document_number",
    "sunbiz_officer_manager_match",
    "ownership_verification_status",
    "google_business_profile_name",
    "google_business_profile_url_or_place_id",
    "verified_business_phone",
    "google_review_count",
    "match_confidence",
    "evidence_source_urls",
    "lead_priority",
    "research_status",
    "possible_duplicate_name",
    "possible_duplicate_score",
    "possible_duplicate_reason",
]
AUDIT_COLUMNS = [f"source_{field}" for field in OFFICIAL_FIELDS] + [
    f"source_{EXTRA_FIELD}"
]
ALL_OUTPUT_COLUMNS = ENRICHED_COLUMNS + AUDIT_COLUMNS


class LayoutError(ValueError):
    """Raised when the input cannot be safely reconciled to DBPR's layout."""


@dataclass(frozen=True)
class LayoutInspection:
    encoding: str
    total_records: int
    malformed_rows: tuple[int, ...]
    has_header: bool
    physical_widths: dict[int, int]
    input_width: int


def clean_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKD", clean_text(value)).encode("ascii", "ignore").decode()
    text = text.upper().replace("&", " AND ")
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_phone(value: object) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else ""


def normalize_license(value: object) -> str:
    return re.sub(r"[^A-Z0-9]", "", clean_text(value).upper())


def parse_as_of(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--as-of must be YYYY-MM-DD") from exc


def _looks_like_header(row: Sequence[str]) -> bool:
    normalized = {normalize_name(cell).replace(" ", "_").lower() for cell in row}
    return "board_number" in normalized and (
        "occupation_code" in normalized or "license_number" in normalized
    )


def _validate_sample(rows: Sequence[Sequence[str]]) -> None:
    if not rows:
        raise LayoutError("The input contains no data records.")
    mapped = [row[:21] for row in rows]
    board_ok = sum(clean_text(row[0]) == "06" for row in mapped) / len(mapped)
    status_ok = sum(clean_text(row[13]).upper() in PRIMARY_STATUS for row in mapped) / len(mapped)
    secondary_ok = sum(clean_text(row[14]).upper() in SECONDARY_STATUS for row in mapped) / len(mapped)
    state_ok = sum(bool(re.fullmatch(r"[A-Z]{2}|", clean_text(row[9]).upper())) for row in mapped) / len(mapped)
    expiration_values = [clean_text(row[17]) for row in mapped if clean_text(row[17])]
    expiration_ok = 0.0
    if expiration_values:
        parsed = pd.to_datetime(pd.Series(expiration_values), format="%m/%d/%Y", errors="coerce")
        expiration_ok = float(parsed.notna().mean())
    official_blank_ok = all(not clean_text(row[18]) for row in mapped)

    problems = []
    if board_ok < 0.95:
        problems.append(f"column 1 Board Number validation was {board_ok:.1%}, expected mostly '06'")
    if status_ok < 0.95:
        problems.append(f"column 14 Primary Status validation was {status_ok:.1%}")
    if secondary_ok < 0.95:
        problems.append(f"column 15 Secondary Status validation was {secondary_ok:.1%}")
    if state_ok < 0.95:
        problems.append(f"column 10 State validation was {state_ok:.1%}")
    if expiration_ok < 0.95:
        problems.append(f"column 18 Expiration Date validation was {expiration_ok:.1%}")
    if not official_blank_ok:
        problems.append("published column 19 ('Blank') contains data")
    if problems:
        raise LayoutError(
            "The CSV columns do not reconcile with DBPR's published 21-field layout: "
            + "; ".join(problems)
            + ". Confirm that this is CONSTRUCTIONLICENSE_1.csv and inspect the source layout."
        )


def inspect_layout(path: Path) -> LayoutInspection:
    if not path.is_file():
        raise FileNotFoundError(f"Input CSV not found: {path}")

    last_decode_error: UnicodeDecodeError | None = None
    for encoding in ("utf-8-sig", "cp1252"):
        widths: Counter[int] = Counter()
        malformed: list[int] = []
        sample: list[list[str]] = []
        header = False
        total = 0
        nonempty_trailing: list[tuple[int, str]] = []
        try:
            with path.open("r", encoding=encoding, errors="strict", newline="") as handle:
                reader = csv.reader(handle)
                for physical_row, row in enumerate(reader, start=1):
                    if physical_row == 1 and _looks_like_header(row):
                        header = True
                        continue
                    total += 1
                    widths[len(row)] += 1
                    if len(row) not in (21, 22):
                        malformed.append(physical_row)
                        continue
                    if len(row) == 22 and row[21].strip():
                        if len(nonempty_trailing) < 5:
                            nonempty_trailing.append((physical_row, row[21].strip()[:80]))
                        continue
                    if len(sample) < 2_000:
                        sample.append(row)
        except UnicodeDecodeError as exc:
            last_decode_error = exc
            continue

        if nonempty_trailing:
            examples = ", ".join(f"row {line}: {value!r}" for line, value in nonempty_trailing)
            raise LayoutError(
                "The file has 22 columns, but column 22 is not an empty trailing artifact "
                f"({examples}). DBPR publishes 21 fields, so processing stopped to avoid shifting columns."
            )
        if not widths:
            raise LayoutError("The input CSV is empty.")
        valid_count = widths.get(21, 0) + widths.get(22, 0)
        if valid_count == 0:
            raise LayoutError(
                f"Expected 21 DBPR fields (or 22 with an empty trailing field); observed widths: {dict(widths)}."
            )
        _validate_sample(sample)
        return LayoutInspection(
            encoding=encoding,
            total_records=total,
            malformed_rows=tuple(malformed),
            has_header=header,
            physical_widths=dict(sorted(widths.items())),
            input_width=22 if widths.get(22, 0) else 21,
        )

    assert last_decode_error is not None
    raise LayoutError(
        "Could not decode the CSV as UTF-8 or Windows-1252. "
        f"Last decoding error: {last_decode_error}"
    )


def read_dbpr_csv(path: Path, layout: LayoutInspection) -> pd.DataFrame:
    names = OFFICIAL_FIELDS + ([EXTRA_FIELD] if layout.input_width == 22 else [])
    skiprows = set(layout.malformed_rows)
    if layout.has_header:
        skiprows.add(1)
    frame = pd.read_csv(
        path,
        header=None,
        names=names,
        dtype=str,
        encoding=layout.encoding,
        keep_default_na=False,
        na_filter=False,
        on_bad_lines="skip",
        skiprows=lambda zero_based: (zero_based + 1) in skiprows,
    )
    if EXTRA_FIELD not in frame:
        frame[EXTRA_FIELD] = ""
    if frame.isna().to_numpy().any():
        frame = frame.fillna("")
    return frame


def _find_columns(columns: Iterable[str], candidates: set[str]) -> list[str]:
    found = []
    for column in columns:
        normalized = re.sub(r"[^a-z0-9]+", "_", str(column).lower()).strip("_")
        if normalized in candidates:
            found.append(column)
    return found


def load_exclusions(path: Path | None) -> tuple[set[str], set[str], set[str], list[str]]:
    if path is None:
        return set(), set(), set(), []
    if not path.is_file():
        raise FileNotFoundError(f"Exclusion CSV not found: {path}")
    try:
        excluded = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except UnicodeDecodeError:
        excluded = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="cp1252")

    name_columns = _find_columns(
        excluded.columns,
        {
            "name", "business_name", "company_name", "contractor_name", "dba",
            "dba_business_name", "google_business_profile_name", "gbp_profile_name",
            "gbp_name", "title",
        },
    )
    phone_columns = _find_columns(
        excluded.columns,
        {"phone", "phone_number", "business_phone", "verified_business_phone", "primary_phone"},
    )
    license_columns = _find_columns(
        excluded.columns,
        {"license", "license_number", "dbpr_license_number", "alternate_license_number"},
    )
    if not name_columns and not phone_columns and not license_columns:
        raise ValueError(
            "The exclusion CSV has no recognized name, phone, or license column. "
            f"Observed columns: {', '.join(map(str, excluded.columns))}"
        )

    names = {
        normalized
        for column in name_columns
        for normalized in excluded[column].map(normalize_name)
        if normalized
    }
    phones = {
        normalized
        for column in phone_columns
        for normalized in excluded[column].map(normalize_phone)
        if normalized
    }
    licenses = {
        normalized
        for column in license_columns
        for normalized in excluded[column].map(normalize_license)
        if normalized
    }
    return names, phones, licenses, sorted(names)


def _join_address(row: pd.Series) -> str:
    parts = [row["address_line_1"], row["address_line_2"], row["address_line_3"]]
    return ", ".join(part for part in parts if part)


def _canonical_license(row: pd.Series) -> str:
    alternate = clean_text(row["alternate_license_number"])
    if alternate:
        return alternate.upper()
    code = clean_text(row["occupation_code"]).upper()
    number = normalize_license(row["license_number"])
    return f"{code}{number}" if code and number else number


def _flag_fuzzy_duplicates(candidates: pd.DataFrame, exclusion_names: list[str]) -> int:
    candidates["possible_duplicate_name"] = ""
    candidates["possible_duplicate_score"] = ""
    candidates["possible_duplicate_reason"] = ""
    if not exclusion_names or candidates.empty:
        return 0
    try:
        from rapidfuzz import fuzz, process
    except ImportError as exc:
        raise RuntimeError(
            "RapidFuzz is required when --exclude contains names. Install dependencies with: "
            "python -m pip install -r scripts/requirements-dbpr-hvac.txt"
        ) from exc

    ambiguous = 0
    for index, row in candidates.iterrows():
        names = [row["normalized_business_name"], row["normalized_contractor_name"]]
        best_name = ""
        best_score = 0.0
        for candidate_name in (name for name in names if name):
            match = process.extractOne(candidate_name, exclusion_names, scorer=fuzz.WRatio, score_cutoff=90)
            if match and match[1] > best_score:
                best_name, best_score = str(match[0]), float(match[1])
        if best_name and best_score < 100:
            candidates.at[index, "possible_duplicate_name"] = best_name
            candidates.at[index, "possible_duplicate_score"] = f"{best_score:.1f}"
            candidates.at[index, "possible_duplicate_reason"] = "Fuzzy name match; review only, not excluded"
            ambiguous += 1
    return ambiguous


def _empty_output_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=ALL_OUTPUT_COLUMNS)


def build_candidates(
    source: pd.DataFrame,
    as_of: date,
    max_age_days: int,
    include_expired: bool,
    exclusion_path: Path | None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    rejected: Counter[str] = Counter()
    board_number = source["board_number"].str.strip()
    occupation_code = source["occupation_code"].str.strip().str.upper()
    relevant_mask = board_number.eq("06") & occupation_code.isin(HVAC_CODES)
    rejected["non_hvac_category"] = int((~relevant_mask).sum())
    frame = source.loc[relevant_mask].copy()
    relevant_count = len(frame)

    # Preserve the source values before normalizing the much smaller HVAC subset.
    for field in OFFICIAL_FIELDS + [EXTRA_FIELD]:
        frame[f"source_{field}"] = frame[field]
        frame[field] = (
            frame[field]
            .astype("string")
            .str.replace(r"\s+", " ", regex=True)
            .str.strip()
            .fillna("")
        )
    frame["occupation_code"] = frame["occupation_code"].str.upper()
    frame["primary_status"] = frame["primary_status"].str.upper()
    frame["secondary_status"] = frame["secondary_status"].str.upper()

    primary_mask = frame["primary_status"].eq("C")
    rejected["primary_status_not_current"] = int((~primary_mask).sum())
    frame = frame.loc[primary_mask].copy()

    secondary_mask = frame["secondary_status"].eq("A")
    rejected["secondary_status_not_active"] = int((~secondary_mask).sum())
    frame = frame.loc[secondary_mask].copy()

    for source_col, parsed_col in (
        ("original_licensure_date", "_original_date"),
        ("effective_date", "_effective_date"),
        ("expiration_date", "_expiration_date"),
    ):
        frame[parsed_col] = pd.to_datetime(
            frame[source_col], format="%m/%d/%Y", errors="coerce"
        )

    if not include_expired:
        invalid_expiration = frame["_expiration_date"].isna()
        rejected["missing_or_invalid_expiration_date"] = int(invalid_expiration.sum())
        frame = frame.loc[~invalid_expiration].copy()
        expired = frame["_expiration_date"].dt.date < as_of
        rejected["expired_as_of_date"] = int(expired.sum())
        frame = frame.loc[~expired].copy()

    invalid_original = frame["_original_date"].isna()
    rejected["missing_or_invalid_original_licensure_date"] = int(invalid_original.sum())
    frame = frame.loc[~invalid_original].copy()
    frame["license_age_days"] = (
        pd.Timestamp(as_of) - frame["_original_date"]
    ).dt.days.astype(int)
    future = frame["license_age_days"] < 0
    rejected["future_original_licensure_date"] = int(future.sum())
    frame = frame.loc[~future].copy()
    active_eligible_count = len(frame)

    older = frame["license_age_days"] > max_age_days
    rejected["older_than_max_age"] = int(older.sum())
    frame = frame.loc[~older].copy()

    frame["dbpr_license_number"] = frame.apply(_canonical_license, axis=1)
    frame["normalized_license_number"] = frame["dbpr_license_number"].map(normalize_license)
    missing_license = frame["normalized_license_number"].eq("")
    rejected["missing_license_number"] = int(missing_license.sum())
    frame = frame.loc[~missing_license].copy()
    frame = frame.sort_values(
        ["_effective_date", "_original_date"], ascending=[False, False], na_position="last"
    )
    duplicate_license = frame.duplicated("normalized_license_number", keep="first")
    rejected["duplicate_license_number"] = int(duplicate_license.sum())
    frame = frame.loc[~duplicate_license].copy()

    frame["contractor_name"] = frame["licensee_name"]
    frame["dba_business_name"] = frame["doing_business_as_name"]
    frame["normalized_contractor_name"] = frame["contractor_name"].map(normalize_name)
    frame["normalized_business_name"] = frame["dba_business_name"].map(normalize_name)
    frame["business_address"] = frame.apply(_join_address, axis=1)
    frame["normalized_business_address"] = frame["business_address"].map(normalize_name)

    exclusion_names, exclusion_phones, exclusion_licenses, fuzzy_names = load_exclusions(exclusion_path)
    del exclusion_phones  # The DBPR licensee layout has no phone field to match safely.
    exact_name = frame["normalized_contractor_name"].isin(exclusion_names) | frame[
        "normalized_business_name"
    ].isin(exclusion_names)
    exact_license = frame["normalized_license_number"].isin(exclusion_licenses)
    exact_excluded = exact_name | exact_license
    rejected["existing_lead_exact_match"] = int(exact_excluded.sum())
    frame = frame.loc[~exact_excluded].copy()

    frame["license_type"] = frame["occupation_code"].map(HVAC_DESCRIPTIONS)
    frame["original_license_date"] = frame["_original_date"].dt.strftime("%Y-%m-%d")
    frame["license_status"] = frame.apply(
        lambda row: (
            f"{PRIMARY_STATUS.get(row['primary_status'], row['primary_status'])} / "
            f"{SECONDARY_STATUS.get(row['secondary_status'], row['secondary_status'])} "
            f"({row['primary_status']}/{row['secondary_status']})"
        ),
        axis=1,
    )
    frame["county"] = frame["county_code"].map(COUNTIES).fillna("")
    frame["lead_priority"] = pd.cut(
        frame["license_age_days"],
        bins=[-1, 365, 730, 1095],
        labels=["Tier 1", "Tier 2", "Tier 3"],
    ).astype("string").fillna("")
    frame["research_status"] = "Needs verification"
    for column in (
        "sunbiz_entity_name",
        "sunbiz_document_number",
        "sunbiz_officer_manager_match",
        "ownership_verification_status",
        "google_business_profile_name",
        "google_business_profile_url_or_place_id",
        "verified_business_phone",
        "google_review_count",
        "match_confidence",
        "evidence_source_urls",
    ):
        frame[column] = ""

    ambiguous_count = _flag_fuzzy_duplicates(frame, fuzzy_names)
    priority_order = pd.Categorical(
        frame["lead_priority"], categories=["Tier 1", "Tier 2", "Tier 3"], ordered=True
    )
    frame = (
        frame.assign(_priority_order=priority_order)
        .sort_values(
            ["_priority_order", "_original_date", "normalized_license_number"],
            ascending=[True, False, True],
        )
        .reset_index(drop=True)
    )

    counts = {
        "relevant_hvac_records": relevant_count,
        "active_eligible_records": active_eligible_count,
        "existing_leads_excluded": rejected["existing_lead_exact_match"],
        "ambiguous_duplicates": ambiguous_count,
        **{f"rejected_{key}": value for key, value in rejected.items()},
    }
    return frame[ALL_OUTPUT_COLUMNS], counts


def write_outputs(
    candidates: pd.DataFrame,
    output_dir: Path,
    summary: dict[str, object],
) -> dict[str, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cohorts = {
        "tier_1": candidates.loc[candidates["license_age_days"].between(0, 365)],
        "tier_2": candidates.loc[candidates["license_age_days"].between(366, 730)],
        "tier_3": candidates.loc[candidates["license_age_days"].between(731, 1095)],
    }
    cohort_counts = {key: len(value) for key, value in cohorts.items()}
    for key, frame in cohorts.items():
        (frame if not frame.empty else _empty_output_frame()).to_csv(
            output_dir / OUTPUT_FILES[key], index=False, encoding="utf-8-sig"
        )
    (candidates if not candidates.empty else _empty_output_frame()).to_csv(
        output_dir / OUTPUT_FILES["verification"], index=False, encoding="utf-8-sig"
    )
    summary["cohort_counts"] = {
        "0_365_days": cohort_counts["tier_1"],
        "366_730_days": cohort_counts["tier_2"],
        "731_1095_days": cohort_counts["tier_3"],
    }
    summary["candidates_needing_verification"] = len(candidates)
    with (output_dir / OUTPUT_FILES["summary"]).open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return cohort_counts


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build prioritized Florida HVAC lead cohorts from DBPR's construction license CSV."
    )
    parser.add_argument("--input", required=True, type=Path, help="Path to CONSTRUCTIONLICENSE_1.csv")
    parser.add_argument("--exclude", type=Path, help="Optional CSV of previously verified/contacted leads")
    parser.add_argument("--output", required=True, type=Path, help="Directory for generated CSV/JSON files")
    parser.add_argument(
        "--as-of",
        type=parse_as_of,
        default=date.today(),
        help="Cohort/status date in YYYY-MM-DD (default: today)",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=1095,
        help="Maximum original-license age to include, 0-1095 (default: 1095)",
    )
    parser.add_argument(
        "--include-expired",
        action="store_true",
        help="Include otherwise active records whose expiration date is before --as-of",
    )
    return parser


def run(args: argparse.Namespace) -> tuple[dict[str, object], dict[str, int]]:
    started = time.perf_counter()
    if not 0 <= args.max_age_days <= 1095:
        raise ValueError("--max-age-days must be between 0 and 1095 so every result belongs to an output cohort")

    layout = inspect_layout(args.input)
    source = read_dbpr_csv(args.input, layout)
    candidates, counts = build_candidates(
        source=source,
        as_of=args.as_of,
        max_age_days=args.max_age_days,
        include_expired=args.include_expired,
        exclusion_path=args.exclude,
    )
    rejected = {
        key.removeprefix("rejected_"): value
        for key, value in counts.items()
        if key.startswith("rejected_")
    }
    rejected["malformed_csv_row"] = len(layout.malformed_rows)
    summary: dict[str, object] = {
        "as_of_date": args.as_of.isoformat(),
        "input_file": str(args.input.resolve()),
        "exclude_file": str(args.exclude.resolve()) if args.exclude else None,
        "dbpr_layout": {
            "published_fields": 21,
            "observed_physical_widths": layout.physical_widths,
            "accepted_empty_trailing_column_22": layout.input_width == 22,
            "encoding": layout.encoding,
        },
        "total_dbpr_records_processed": layout.total_records,
        "relevant_hvac_records": counts["relevant_hvac_records"],
        "active_eligible_records": counts["active_eligible_records"],
        "existing_leads_excluded": counts["existing_leads_excluded"],
        "ambiguous_duplicates": counts["ambiguous_duplicates"],
        "rejected_record_counts_by_reason": rejected,
        "include_expired": args.include_expired,
        "max_age_days": args.max_age_days,
    }
    cohort_counts = write_outputs(candidates, args.output, summary)
    duration = time.perf_counter() - started
    summary["processing_duration_seconds"] = round(duration, 3)
    with (args.output / OUTPUT_FILES["summary"]).open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return summary, cohort_counts


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        summary, cohorts = run(args)
    except (FileNotFoundError, LayoutError, RuntimeError, ValueError) as exc:
        parser.exit(2, f"error: {exc}\n")
    print(f"Processed {summary['total_dbpr_records_processed']:,} DBPR records.")
    print(f"HVAC 0-365 days: {cohorts['tier_1']:,}")
    print(f"HVAC 366-730 days: {cohorts['tier_2']:,}")
    print(f"HVAC 731-1095 days: {cohorts['tier_3']:,}")
    print(f"Existing leads excluded: {summary['existing_leads_excluded']:,}")
    print(f"Potential duplicates for review: {summary['ambiguous_duplicates']:,}")
    print(f"Processing time: {summary['processing_duration_seconds']:.3f} seconds")
    print(f"Outputs: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
