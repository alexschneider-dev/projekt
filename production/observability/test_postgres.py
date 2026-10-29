import datetime as dt
import gzip
import io
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import (
    MagicMock,
    patch,
)


sys.path.insert(0, str(Path(__file__).parent / "backup"))
import postgres


class PostgresTests(unittest.TestCase):
    def test_snapshot_streams_complete_dump(self):
        process = MagicMock()
        process.__enter__.return_value = process
        process.stdout = io.BytesIO(b"CREATE DATABASE beispiel;\n")
        process.wait.return_value = 0
        with tempfile.TemporaryDirectory() as tmp, patch.object(subprocess, "Popen", return_value=process) as start:
            archive = Path(tmp) / "backup.sql.gz"
            postgres.snapshot("container-id", archive)
            self.assertEqual(gzip.decompress(archive.read_bytes()), b"CREATE DATABASE beispiel;\n")
            self.assertIn("pg_dumpall", start.call_args.args[0])
            self.assertFalse(archive.with_suffix(".tmp").exists())

    def test_failed_or_empty_dump_leaves_no_archive(self):
        for code, content in [
            (1, b"partial"),
            (0, b""),
        ]:
            process = MagicMock()
            process.__enter__.return_value = process
            process.stdout = io.BytesIO(content)
            process.wait.return_value = code
            with tempfile.TemporaryDirectory() as tmp, patch.object(subprocess, "Popen", return_value=process):
                archive = Path(tmp) / "backup.sql.gz"
                with self.assertRaises(RuntimeError):
                    postgres.snapshot("container-id", archive)
                self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_upload_failure_retains_local_dump_and_skips_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(postgres, "ROOT", Path(tmp)):
            with patch.object(postgres.storage, "S3") as s3, patch.object(postgres.storage, "container"):
                with patch.object(postgres, "snapshot") as snapshot, patch.object(postgres, "cleanup") as cleanup:
                    snapshot.side_effect = lambda ident, path: path.write_bytes(b"archive")
                    s3.return_value.upload_verified.side_effect = RuntimeError(postgres.ERRORS["POSTGRES_DUMP"])
                    with self.assertRaises(RuntimeError):
                        postgres.backup()
                    self.assertEqual(len(list(Path(tmp).glob("*.sql.gz"))), 1)
                    cleanup.assert_not_called()
                    self.assertTrue(s3.return_value.upload_verified.call_args.args[1].startswith(postgres.PREFIX))

    def test_cleanup_only_removes_expired_own_archives(self):
        now = dt.datetime.now(dt.timezone.utc)
        with tempfile.TemporaryDirectory() as tmp, patch.object(postgres, "ROOT", Path(tmp)):
            old = Path(tmp) / ("20260101T000000Z-" + "a" * 32 + ".sql.gz")
            recent = Path(tmp) / ("20260101T000001Z-" + "b" * 32 + ".sql.gz")
            foreign = Path(tmp) / "anderes.sql.gz"
            for path in [
                old,
                recent,
                foreign,
            ]:
                path.touch()
            for path in [
                old,
                foreign,
            ]:
                os.utime(path, (0, 0))
            postgres.cleanup(now)
            self.assertFalse(old.exists())
            self.assertTrue(recent.exists())
            self.assertTrue(foreign.exists())

    def test_failure_sets_failed_metric(self):
        with patch.object(postgres, "backup", side_effect=RuntimeError(postgres.ERRORS["POSTGRES_DUMP"])):
            with patch.object(postgres.storage, "backup_metric") as metric:
                with self.assertRaises(RuntimeError):
                    postgres.main()
                metric.assert_called_once_with(False, "postgres")


if __name__ == "__main__":
    unittest.main()
