"""Swarm-Testdaten ohne Docker- oder Produktionszugriff."""

import importlib.util
import json
from pathlib import Path
import unittest
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

spec = importlib.util.spec_from_file_location(
    "exporter", Path(__file__).resolve().parents[1] / "export-audit-images.py"
)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
PIN = "ghcr.io/example/app:1@sha256:" + "a" * 64


class ExportTests(unittest.TestCase):
    def fixture(self, state="running", task_image=PIN, desired=PIN, digests=None, draining=False):
        def docker(*args):
            if args[:2] == (
                "service",
                "ls",
            ):
                return "svc-" + args[3].split("=")[-1]
            if args[:2] == (
                "service",
                "inspect",
            ):
                return args[2].replace("svc-", "") + "_app " + desired
            if args[:2] == (
                "service",
                "ps",
            ):
                if "--filter" in args:
                    return "task"
                return "task Running 1 hour ago" + ("\nold Running 2 hours ago" if draining else "")
            if args[:2] == (
                "inspect",
                "--type",
            ):
                return json.dumps(
                    {
                        "state": state,
                        "image": task_image,
                        "container": "actual-container",
                    }
                )
            if args[:2] == (
                "container",
                "inspect",
            ):
                self.assertEqual(args[2], "actual-container")
                return "sha256:actual-local-image"
            if args[:2] == (
                "image",
                "inspect",
            ):
                self.assertEqual(args[2], "sha256:actual-local-image")
                return json.dumps(digests)
            self.fail(str(args))

        return docker

    def test_pinned_running_tasks(self):
        with patch.object(exporter, "docker", self.fixture()):
            self.assertEqual(
                exporter.capture(), f"observability_app {PIN}\nprojekt-edge_app {PIN}\nprojekt_app {PIN}\n"
            )

    def test_tag_only_resolves_actual_container_not_registry(self):
        digest = "ghcr.io/example/app@sha256:" + "b" * 64
        with patch.object(
            exporter,
            "docker",
            self.fixture(desired="ghcr.io/example/app:1", task_image="ghcr.io/example/app:1", digests=[digest]),
        ):
            self.assertIn(digest, exporter.capture())

    def test_unconverged_missing_or_ambiguous_images_fail(self):
        for fixture in [
            self.fixture(state="pending"),
            self.fixture(task_image=PIN.replace(":1@", ":2@")),
            self.fixture(draining=True),
            self.fixture(desired="app:1", task_image="app:1", digests=[]),
        ]:
            with self.subTest(), patch.object(exporter, "docker", fixture), self.assertRaises(ValueError):
                exporter.capture()

    def test_no_services_fails(self):
        with patch.object(exporter, "docker", return_value=""), self.assertRaises(ValueError):
            exporter.capture()

    def test_registry_port_is_preserved(self):
        self.assertEqual(exporter.repository("registry.example:5000/team/app:1"), "registry.example:5000/team/app")


if __name__ == "__main__":
    unittest.main()
