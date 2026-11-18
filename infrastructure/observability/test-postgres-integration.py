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
        init_dir = Path(self.enterContext(tempfile.TemporaryDirectory(
            dir=Path(__file__).resolve().parents[2],
            prefix=".postgres-init-",
        )))
        init_script = init_dir / "startphase.sql"
        # Die temporäre Socket-Instanz muss lange genug für die Gegenprobe erreichbar sein.
        init_script.write_text("SELECT pg_sleep(3);\n")

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
                    "-v",
                    f"{init_script}:/docker-entrypoint-initdb.d/startphase.sql:ro",
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
                        "-h",
                        "127.0.0.1",
                        "-U",
                        user,
                    ],
                    capture_output=True,
                )
                if result.returncode == 0:
                    process = subprocess.run(
                        [
                            "docker",
                            "exec",
                            name,
                            "cat",
                            "/proc/1/comm",
                        ],
                        capture_output=True,
                        check=True,
                    )
                    self.assertEqual(process.stdout.strip(), b"postgres")
                    return name
                time.sleep(1)
            self.fail(postgres.ERRORS["POSTGRES_DUMP"])

        def sql(name, user, content):
            result = subprocess.run(
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
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
            return result.stdout

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
