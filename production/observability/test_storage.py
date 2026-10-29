import sys
from pathlib import Path
import datetime as dt
import importlib.util
import sqlite3
import tarfile
import tempfile
import unittest


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


def module(name):
    spec = importlib.util.spec_from_file_location(
        name,
        Path(__file__).parent / "backup" / (name + ".py"),
    )
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


storage = module("storage")
snapshot = module("snapshot")


class StorageTests(unittest.TestCase):
    def test_retention_boundaries_and_prefix_isolation(self):
        p = storage.PREFIX
        keys = [
            p + suffix
            for suffix in [
                "daily/2026-09-27.tar.gz",
                "daily/2026-09-28.tar.gz",
                "daily/2026-10-27.tar.gz",
                "daily/2026-10-28.tar.gz",
                "monthly/2025-10.tar.gz",
                "monthly/2025-11.tar.gz",
                "monthly/2026-10.tar.gz",
                "daily/2020-99-99.tar.gz",
                "monthly/2020-01-01.tar.gz",
                "unknown/2020-01-01.tar.gz",
            ]
        ]
        keys += [
            "production/loki/daily/2020-01-01.tar.gz",
            "production/postgres/2020-01-01.tar.gz",
            p + "daily/../2020-01-01.tar.gz",
        ]
        self.assertEqual(
            list(
                storage.expired_keys(
                    keys,
                    dt.date(
                        2026,
                        10,
                        27,
                    ),
                )
            ),
            [
                p + "daily/2026-09-27.tar.gz",
                p + "monthly/2025-10.tar.gz",
            ],
        )

    def test_live_wal_sqlite_backup_can_be_restored(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, out, restored = [
                root / name
                for name in [
                    "source",
                    "out",
                    "restore",
                ]
            ]
            for p in [
                src,
                out,
                restored,
            ]:
                p.mkdir()
            with sqlite3.connect(src / "grafana.db") as live:
                live.execute("PRAGMA journal_mode=WAL")
                live.execute("CREATE TABLE dashboard (title TEXT)")
                live.execute("INSERT INTO dashboard VALUES ('Recovery test')")
                live.commit()
                snapshot.snapshot(
                    src,
                    out,
                    "grafana:test",
                )
                with tarfile.open(out / "grafana.tar.gz") as archive:
                    archive.extractall(
                        restored,
                        filter="data",
                    )
                with sqlite3.connect(restored / "grafana.db") as recovered:
                    self.assertEqual(
                        recovered.execute("SELECT title FROM dashboard").fetchone(),
                        ("Recovery test",),
                    )
                    self.assertEqual(
                        recovered.execute("PRAGMA integrity_check").fetchone(),
                        ("ok",),
                    )


class FailureTests(unittest.TestCase):
    def test_failed_upload_never_lists_or_deletes_archives(self):
        from unittest.mock import patch, MagicMock

        s3 = MagicMock()
        s3.upload_verified.side_effect = RuntimeError(ERRORS["E17"])
        with tempfile.TemporaryDirectory() as tmp, patch.object(
            storage,
            "ROOT",
            Path(tmp),
        ), patch.object(
            storage,
            "S3",
            return_value=s3,
        ), patch.object(
            storage,
            "container",
            return_value="grafana-id",
        ), patch.object(
            storage,
            "docker",
            side_effect=[
                "grafana:test",
                '[{"Type":"volume","Name":"test","Destination":"/var/lib/grafana"}]',
                "",
            ],
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "Test-Upload",
            ):
                storage.backup()
        s3.objects.assert_not_called()
        s3.aws.assert_not_called()

    def test_backup_metric_helper_is_valid_python(self):
        from unittest.mock import patch

        with patch.object(
            storage,
            "docker",
        ) as docker:
            storage.backup_metric(True)
        args = docker.call_args.args
        compile(
            args[args.index("-c") + 1],
            "<metric helper>",
            "exec",
        )


class SecretBackupTests(unittest.TestCase):
    def run_aws(
        self,
        state,
    ):
        from unittest.mock import patch

        service = storage.S3.__new__(storage.S3)
        service.cfg = {
            "endpoint": "https://s3.test",
            "region": "test-region",
        }
        service.secret = "projekt_obs_loki_s3_credentials_r1"
        service.image = "amazon/aws-cli:test"
        service.node = "local-manager"
        calls = []

        def docker(*args):
            calls.append(args)
            if args[:2] == (
                "service",
                "ps",
            ):
                return "task-id"
            if args[0] == "inspect":
                return '{"State":"' + state + '","ContainerStatus":{"ExitCode":0}}'
            if args[:2] == (
                "service",
                "logs",
            ):
                return '{"Contents":[]}'
            return ""

        with patch.object(
            storage,
            "docker",
            side_effect=docker,
        ):
            if state == "complete":
                self.assertEqual(
                    service.aws(
                        "s3api",
                        "list-buckets",
                    ),
                    '{"Contents":[]}',
                )
            else:
                with self.assertRaisesRegex(
                    RuntimeError,
                    "S3-Task",
                ):
                    service.aws(
                        "s3api",
                        "list-buckets",
                    )
        return calls

    def test_aws_uses_swarm_secret_without_host_credentials(self):
        calls = self.run_aws("complete")
        create = calls[0]
        self.assertEqual(
            create[:2],
            (
                "service",
                "create",
            ),
        )
        self.assertIn(
            "source=projekt_obs_loki_s3_credentials_r1,target=s3_credentials",
            create,
        )
        self.assertIn(
            "AWS_SHARED_CREDENTIALS_FILE=/run/secrets/s3_credentials",
            create,
        )
        self.assertIn(
            "node.id==local-manager",
            create,
        )
        self.assertNotIn(
            "--mount",
            create,
        )
        self.assertFalse(
            any(
                "AWS_SECRET_ACCESS_KEY=" in value or "AWS_ACCESS_KEY_ID=" in value
                for value in create
            )
        )
        self.assertEqual(
            calls[-1][:2],
            (
                "service",
                "rm",
            ),
        )

    def test_failed_aws_task_is_removed(self):
        calls = self.run_aws("failed")
        self.assertEqual(
            calls[-1][:2],
            (
                "service",
                "rm",
            ),
        )


if __name__ == "__main__":
    unittest.main()
