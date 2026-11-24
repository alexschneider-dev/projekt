"""Prüft sichere Importe, Vollständigkeit und die Scan-Gruppierung."""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location("audit", ROOT / "image-audit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
PIN = "example/app:1@sha256:" + "a" * 64


class InventoryTests(unittest.TestCase):
    def test_shared_images_are_grouped(self):
        result = audit.matrix(
            {
                "projekt_nextjs": PIN,
                "projekt_jobs": PIN,
            }
        )["include"]
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["services"], "projekt_jobs, projekt_nextjs")
        self.assertEqual(result[0]["image"], PIN)

    def test_only_approved_services_are_report_only(self):
        approved = {
            "projekt_postgres",
            "observability_grafana",
            "observability_alloy",
        }
        for name in [
            *sorted(approved),
            "projekt_nextjs",
            "projekt_redis",
            "observability_postgres-exporter",
            "observability_grafana-backup",
            "observability_loki",
        ]:
            with self.subTest(service=name):
                row = audit.matrix({name: PIN})["include"][0]
                self.assertEqual(row["report_only"], name in approved)

    def test_shared_image_remains_blocking_for_strict_service(self):
        row = audit.matrix({
            "projekt_postgres": PIN,
            "projekt_nextjs": PIN,
        })["include"][0]
        self.assertFalse(row["report_only"])

    def test_shared_image_of_approved_services_is_report_only(self):
        row = audit.matrix({
            "observability_grafana": PIN,
            "observability_alloy": PIN,
        })["include"][0]
        self.assertTrue(row["report_only"])

    def test_invalid_exports_fail(self):
        for value in [
            "",
            "projekt_nginx nginx:latest",
            f"projekt_nginx {PIN}\nprojekt_nginx {PIN}",
            f"unknown_service {PIN}",
            "projekt_nginx nginx@sha256:123",
            f"projekt_nginx {PIN} secret=value",
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                audit.parse_export(value)

    def test_import_is_complete_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inventory = root / "inventory.json"
            required = root / "required.json"
            exported = root / "export.txt"
            required.write_text(
                json.dumps(
                    [
                        "projekt_nginx",
                        "projekt_nextjs",
                    ]
                )
            )
            inventory.write_text("original")
            exported.write_text(f"projekt_nginx {PIN}\n")
            args = [
                sys.executable,
                str(ROOT / "image-audit.py"),
                "--inventory",
                str(inventory),
                "--required-services",
                str(required),
                "--import-export",
                str(exported),
            ]
            result = subprocess.run(args, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(inventory.read_text(), "original")

            exported.write_text(f"projekt_nginx {PIN}\nprojekt_nextjs {PIN}\n")
            result = subprocess.run(args, capture_output=True, text=True, check=True)
            self.assertEqual(len(json.loads(result.stdout)["include"]), 1)
            self.assertIn("capturedAt", json.loads(inventory.read_text()))


if __name__ == "__main__":
    unittest.main()
