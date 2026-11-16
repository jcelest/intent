import csv
import json
import sys
import tempfile
import unittest
from argparse import Namespace
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import dbpr_hvac_leads as pipeline


def record(
    code,
    name,
    dba,
    license_number,
    original_date,
    expiration_date="12/31/2030",
    primary="C",
    secondary="A",
):
    return [
        "06", code, name, dba, "", "123 MAIN ST", "", "", "ORLANDO", "FL",
        "32801", "58", license_number, primary, secondary, original_date,
        original_date, expiration_date, "", "", f"{code}{license_number}", "",
    ]


class DbprHvacPipelineTests(unittest.TestCase):
    def write_csv(self, path, rows):
        with path.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows(rows)

    def test_cohorts_status_expiration_dedup_and_summary_reconcile(self):
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            source = temp / "licenses.csv"
            output = temp / "out"
            self.write_csv(
                source,
                [
                    record("CAC", "NEW, NORA", "NORA AIR LLC", "1000001", "07/01/2025"),
                    record("CMC", "MID, MARCO", "MARCO MECH", "1000002", "07/01/2024"),
                    record("RA", "OLDER, OLIVE", "OLIVE AIR", "1000003", "07/01/2023"),
                    record("RM", "INACTIVE, IVAN", "IVAN MECH", "1000004", "07/01/2025", secondary="I"),
                    record("CAC", "EXPIRED, EVE", "EVE AIR", "1000005", "07/01/2025", expiration_date="01/01/2025"),
                    record("CBC", "BUILDER, BOB", "BOB BUILDS", "1000006", "07/01/2025"),
                    record("CAC", "BAD, DATE", "BAD DATE AIR", "1000007", "NOT A DATE"),
                    record("CAC", "DUP, DON", "DUP AIR", "1000001", "06/01/2025"),
                ],
            )
            args = Namespace(
                input=source,
                exclude=None,
                output=output,
                as_of=date(2026, 1, 1),
                max_age_days=1095,
                include_expired=False,
            )
            summary, cohorts = pipeline.run(args)
            self.assertEqual(cohorts, {"tier_1": 1, "tier_2": 1, "tier_3": 1})
            self.assertEqual(summary["candidates_needing_verification"], 3)
            self.assertEqual(sum(summary["cohort_counts"].values()), 3)
            self.assertEqual(summary["rejected_record_counts_by_reason"]["duplicate_license_number"], 1)
            self.assertEqual(summary["rejected_record_counts_by_reason"]["expired_as_of_date"], 1)
            self.assertEqual(summary["rejected_record_counts_by_reason"]["secondary_status_not_active"], 1)
            with (output / "hvac_pipeline_summary.json").open(encoding="utf-8") as handle:
                on_disk = json.load(handle)
            self.assertEqual(on_disk["cohort_counts"], summary["cohort_counts"])

    def test_exact_exclusion_and_fuzzy_match_is_review_only(self):
        try:
            import rapidfuzz  # noqa: F401
        except ImportError:
            self.skipTest("RapidFuzz is not installed")
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            source = temp / "licenses.csv"
            exclusion = temp / "excluded.csv"
            output = temp / "out"
            self.write_csv(
                source,
                [
                    record("CAC", "EXACT, ERIN", "EXACT AIR LLC", "2000001", "07/01/2025"),
                    record("CMC", "FUZZY, FRANK", "SUNSHINE MECHANICAL LLC", "2000002", "07/01/2025"),
                ],
            )
            with exclusion.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["business_name", "phone"])
                writer.writeheader()
                writer.writerow({"business_name": "Exact Air, LLC", "phone": "(407) 555-1212"})
                writer.writerow({"business_name": "Sunshine Mechanical", "phone": ""})
            summary, _ = pipeline.run(
                Namespace(
                    input=source,
                    exclude=exclusion,
                    output=output,
                    as_of=date(2026, 1, 1),
                    max_age_days=1095,
                    include_expired=False,
                )
            )
            self.assertEqual(summary["existing_leads_excluded"], 1)
            self.assertEqual(summary["ambiguous_duplicates"], 1)
            remaining = pipeline.pd.read_csv(output / "hvac_needs_verification.csv")
            self.assertEqual(len(remaining), 1)
            self.assertIn("review only", remaining.loc[0, "possible_duplicate_reason"].lower())

    def test_cohort_boundaries_are_inclusive_and_do_not_overlap(self):
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            source = temp / "licenses.csv"
            output = temp / "out"
            as_of = date(2026, 1, 1)
            ages = [0, 365, 366, 730, 731, 1095]
            rows = []
            for index, age in enumerate(ages, start=1):
                original = (as_of - timedelta(days=age)).strftime("%m/%d/%Y")
                rows.append(record("CAC", f"BOUNDARY, {age}", "", f"4{index:06d}", original))
            self.write_csv(source, rows)
            summary, cohorts = pipeline.run(
                Namespace(
                    input=source,
                    exclude=None,
                    output=output,
                    as_of=as_of,
                    max_age_days=1095,
                    include_expired=False,
                )
            )
            self.assertEqual(cohorts, {"tier_1": 2, "tier_2": 2, "tier_3": 2})
            self.assertEqual(summary["candidates_needing_verification"], 6)
            observed = []
            for filename in (
                "hvac_0_365_days.csv",
                "hvac_366_730_days.csv",
                "hvac_731_1095_days.csv",
            ):
                frame = pipeline.pd.read_csv(output / filename)
                observed.extend(frame["license_age_days"].tolist())
            self.assertEqual(sorted(observed), ages)

    def test_nonempty_column_22_fails_with_actionable_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "bad-layout.csv"
            row = record("CAC", "TEST, TERRY", "TEST AIR", "3000001", "07/01/2025")
            row[-1] = "UNPUBLISHED DATA"
            self.write_csv(source, [row])
            with self.assertRaisesRegex(pipeline.LayoutError, "column 22"):
                pipeline.inspect_layout(source)


if __name__ == "__main__":
    unittest.main()
