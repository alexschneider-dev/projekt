import gzip
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
import uuid


sys.path.insert(0, str(Path(__file__).parent / "backup"))
import postgres


class PostgresIntegrationTests(unittest.TestCase):
    def test_dump_restores_roles_schema_and_data(self):
        names = []

        def cleanup():
            for name in names:
                subprocess.run(
                    [
                        "docker",
                        "rm",
                        "-fv",
                        name,
                    ],
                    capture_output=True,
                    check=True,
                )

        self.addCleanup(cleanup)

        def start(user):
            name = "projekt-backup-test-" + uuid.uuid4().hex
            names.append(name)
            subprocess.run(
                [
                    "docker",
                    "run",
                    "-d",
                    "--name",
                    name,
                    "--network=none",
                    "-e",
                    "POSTGRES_HOST_AUTH_METHOD=trust",
                    "-e",
                    f"POSTGRES_USER={user}",
                    "postgres:17",
                ],
                check=True,
                capture_output=True,
            )
            for attempt in range(60):
                result = subprocess.run(
                    [
                        "docker",
                        "exec",
                        name,
                        "pg_isready",
                        "-U",
                        user,
                    ],
                    capture_output=True,
                )
                if result.returncode == 0:
                    return name
                time.sleep(1)
            self.fail(postgres.ERRORS["POSTGRES_DUMP"])

        def sql(name, user, content):
            return subprocess.run(
                [
                    "docker",
                    "exec",
                    "-i",
                    "--user=postgres",
                    name,
                    "psql",
                    "-U",
                    user,
                    "-d",
                    "postgres",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-At",
                ],
                input=content,
                capture_output=True,
                check=True,
            ).stdout

        source = start("postgres")
        sql(source, "postgres", b"CREATE ROLE beispiel; CREATE TABLE probe (wert text); INSERT INTO probe VALUES ('gesichert');")
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "postgres.sql.gz"
            postgres.snapshot(source, archive)
            target = start("restore_admin")
            sql(target, "restore_admin", gzip.decompress(archive.read_bytes()))
            self.assertEqual(sql(target, "restore_admin", b"SELECT wert FROM probe;"), b"gesichert\n")
            self.assertEqual(sql(target, "restore_admin", b"SELECT rolname FROM pg_roles WHERE rolname='beispiel';"), b"beispiel\n")


if __name__ == "__main__":
    unittest.main()
