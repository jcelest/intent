import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import google_places_hvac_enrich as enrich


class GooglePlacesEnrichTests(unittest.TestCase):
    def row(self):
        return {
            "dbpr_license_number": "CAC123",
            "sunbiz_entity_name": "Alpha Air & Heating LLC",
            "dba_business_name": "Alpha Air",
            "contractor_name": "OWNER, ALICE",
            "business_address": "123 Main Street",
            "city": "Orlando",
            "zip": "32801",
            "sunbiz_match_confidence": "high_officer",
            "google_business_profile_name": "",
            "google_business_profile_url_or_place_id": "",
            "verified_business_phone": "",
            "google_review_count": "",
            "evidence_source_urls": "https://search.sunbiz.org/example",
        }

    def test_select_place_uses_name_and_location(self):
        places = [
            {
                "id": "wrong",
                "displayName": {"text": "Beta Plumbing"},
                "formattedAddress": "900 Elsewhere Rd, Tampa, FL 33602",
            },
            {
                "id": "right",
                "displayName": {"text": "Alpha Air and Heating"},
                "formattedAddress": "123 Main St, Orlando, FL 32801",
            },
        ]
        selected, score = enrich.select_place(self.row(), places)
        self.assertEqual(selected["id"], "right")
        self.assertGreaterEqual(score, enrich.MATCH_THRESHOLD)

    def test_details_cap_is_reserved_before_requests(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            usage = root / "usage.json"
            usage.write_text(json.dumps({"detail_attempts": 999}), encoding="utf-8")
            cache = root / "details.jsonl"
            rows = []
            for suffix in ("1", "2"):
                row = self.row()
                row["dbpr_license_number"] += suffix
                rows.append((row, {"place": {"id": f"place{suffix}"}, "match_score": 1.0}))

            original = enrich.request_json
            enrich.request_json = lambda *args, **kwargs: {"id": "ok", "nationalPhoneNumber": "(407) 555-1212"}
            try:
                records = enrich.run_details(rows, "key", cache, usage, 1000)
            finally:
                enrich.request_json = original
            self.assertEqual(enrich.read_usage(usage), 1000)
            self.assertEqual(len(records), 1)

    def test_search_retries_cached_errors_without_spending_success_cap(self):
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary) / "search.jsonl"
            row = self.row()
            enrich.append_jsonl(
                cache,
                {"lead_key": enrich.lead_key(row), "status": "error", "error": "HTTP 429"},
            )
            original = enrich.search_one
            enrich.search_one = lambda candidate, api_key: {
                "lead_key": enrich.lead_key(candidate),
                "status": "no_confident_match",
                "match_score": 0,
                "place": None,
            }
            try:
                records = enrich.run_searches([row], "key", cache, cap=1, workers=1)
            finally:
                enrich.search_one = original
            self.assertEqual(records[enrich.lead_key(row)]["status"], "no_confident_match")

    def test_merge_writes_phone_and_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "out.csv"
            row = self.row()
            key = enrich.lead_key(row)
            searches = {
                key: {
                    "status": "matched",
                    "match_score": 0.99,
                    "place": {"id": "abc", "displayName": {"text": "Alpha Air"}},
                }
            }
            details = {
                key: {
                    "status": "enriched",
                    "details": {
                        "id": "abc",
                        "displayName": {"text": "Alpha Air"},
                        "nationalPhoneNumber": "(407) 555-1212",
                        "userRatingCount": 42,
                        "googleMapsUri": "https://maps.google.com/example",
                    },
                }
            }
            counts = enrich.merge_output([row], list(row), searches, details, output)
            with output.open(encoding="utf-8-sig", newline="") as handle:
                merged = next(csv.DictReader(handle))
            self.assertEqual(counts["phones_found"], 1)
            self.assertEqual(merged["verified_business_phone"], "(407) 555-1212")
            self.assertIn("maps.google.com", merged["evidence_source_urls"])


if __name__ == "__main__":
    unittest.main()
