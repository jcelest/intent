import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sunbiz_hvac_match as matcher


def put(record, start, length, value):
    encoded = value.encode("cp1252")[:length]
    record[start - 1 : start - 1 + length] = encoded.ljust(length, b" ")


def entity_record(doc, name, status, address, city, zip_code, officer="", title="MGR"):
    record = bytearray(b" " * matcher.RECORD_LENGTH)
    put(record, 1, 12, doc)
    put(record, 13, 192, name)
    put(record, 205, 1, status)
    put(record, 206, 15, "FLAL")
    put(record, 221, 42, address)
    put(record, 305, 28, city)
    put(record, 333, 2, "FL")
    put(record, 335, 10, zip_code)
    put(record, 473, 8, "01012025")
    if officer:
        put(record, 669, 4, title)
        put(record, 673, 1, "P")
        put(record, 674, 42, officer)
    return bytes(record) + b"\r\n"


class SunbizMatcherTests(unittest.TestCase):
    def candidate_frame(self):
        return pd.DataFrame(
            [
                {
                    "dbpr_license_number": "CAC1",
                    "dba_business_name": "Alpha Air LLC",
                    "contractor_name": "OWNER, ALICE",
                    "business_address": "123 MAIN ST",
                    "city": "ORLANDO",
                    "zip": "32801",
                    "sunbiz_entity_name": "",
                    "sunbiz_document_number": "",
                    "sunbiz_officer_manager_match": "",
                    "ownership_verification_status": "",
                    "evidence_source_urls": "",
                    "research_status": "",
                    "match_confidence": "",
                },
                {
                    "dbpr_license_number": "CAC2",
                    "dba_business_name": "Beta Cooling, Inc.",
                    "contractor_name": "TECH, TOM",
                    "business_address": "456 OAK RD",
                    "city": "TAMPA",
                    "zip": "33602",
                    "sunbiz_entity_name": "",
                    "sunbiz_document_number": "",
                    "sunbiz_officer_manager_match": "",
                    "ownership_verification_status": "",
                    "evidence_source_urls": "",
                    "research_status": "",
                    "match_confidence": "",
                },
            ]
        )

    def test_streaming_match_and_ownership_caution(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            candidates_path = root / "candidates.csv"
            cordata = root / "cordata"
            output = root / "out"
            cordata.mkdir()
            self.candidate_frame().to_csv(candidates_path, index=False, encoding="utf-8-sig")
            records = [
                entity_record(
                    "L25000000001", "ALPHA AIR, L.L.C.", "A", "123 MAIN STREET",
                    "ORLANDO", "32801", "OWNER          ALICE", "MGRM",
                ),
                entity_record(
                    "P25000000002", "BETA COOLING INC", "A", "456 OAK ROAD",
                    "TAMPA", "33602", "SOMEONE        ELSE", "P",
                ),
            ]
            (cordata / "cordata0.txt").write_bytes(b"".join(records))
            frame, candidates = matcher.load_candidates(candidates_path)
            matches, stats = matcher.scan_cordata(cordata, candidates)
            summary = matcher.apply_matches(frame, matches, output, stats)
            enriched = pd.read_csv(output / "hvac_sunbiz_enriched.csv", keep_default_na=False)
            self.assertEqual(summary["best_match_counts"]["high_officer"], 1)
            self.assertEqual(summary["best_match_counts"]["high_entity"], 1)
            self.assertIn("ownership not independently proven", enriched.loc[0, "ownership_verification_status"])
            self.assertEqual(enriched.loc[1, "ownership_verification_status"], "Not verified")

    def test_record_width_is_validated(self):
        with self.assertRaisesRegex(ValueError, "1440-byte"):
            matcher.parse_entity(b"short")

    def test_inactive_duplicate_loses_to_active_entity(self):
        candidate = matcher.Candidate(
            0, "Gamma HVAC LLC", "GAMMA HVAC LLC", "GAMMA HVAC", "GAMMA, GINA",
            "GAMMA GINA", "1 FIRST ST", "1 FIRST ST", "MIAMI", "33101",
        )
        inactive = matcher.parse_entity(
            entity_record("L20000000001", "GAMMA HVAC LLC", "I", "1 FIRST ST", "MIAMI", "33101")[:-2]
        )
        active = matcher.parse_entity(
            entity_record("L25000000002", "GAMMA HVAC LLC", "A", "1 FIRST ST", "MIAMI", "33101")[:-2]
        )
        inactive_match = matcher.score_match(candidate, inactive, None)
        active_match = matcher.score_match(candidate, active, None)
        self.assertGreater(matcher.match_sort_key(active_match), matcher.match_sort_key(inactive_match))


if __name__ == "__main__":
    unittest.main()
