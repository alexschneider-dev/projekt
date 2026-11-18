import importlib.util
from pathlib import Path
import sys
import unittest


spec = importlib.util.spec_from_file_location(
    "loki_query_integration",
    Path(__file__).with_name("test-loki-query-integration.py"),
)
loki = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loki)


class LokiCommandTest(unittest.TestCase):
    def test_image_pull_progress_does_not_corrupt_container_id(self):
        output = loki.command(
            sys.executable,
            "-c",
            'import sys; print("Pulling image layers", file=sys.stderr); print("a"*64)',
        )
        self.assertEqual(
            output,
            "a" * 64,
        )

    def test_error_logs_on_stderr_are_still_checked(self):
        output = loki.command(
            sys.executable,
            "-c",
            'import sys; print("level=info ready"); print("level=error scheduler EOF", file=sys.stderr)',
            include_stderr=True,
        )
        self.assertIn(
            "level=info ready",
            output,
        )
        self.assertIn(
            "level=error scheduler EOF",
            output,
        )

    def test_failed_command_reports_diagnostics(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "container missing",
        ):
            loki.command(
                sys.executable,
                "-c",
                'import sys; print("container missing", file=sys.stderr); sys.exit(1)',
            )


if __name__ == "__main__":
    unittest.main()
