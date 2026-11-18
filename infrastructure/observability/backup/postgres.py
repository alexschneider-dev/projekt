import datetime as dt
import gzip
import os
from pathlib import Path
import re
import shutil
import subprocess
import uuid

import storage
from messages import ERRORS


PREFIX = "projekt/production/postgres/"
ROOT = Path("/etc/projekt/postgres-backups")
RETENTION_DAYS = 14


def snapshot(ident, archive):
    temporary = archive.with_suffix(".tmp")
    try:
        with temporary.open("xb") as raw, gzip.GzipFile(fileobj=raw, mode="wb") as compressed:
            # Lokaler Socket als Datenbank-Betriebssystembenutzer; keine Passwortkopie.
            command = [
                "docker",
                "exec",
                "--user",
                "postgres",
                ident,
                "pg_dumpall",
                "--username=postgres",
                "--no-password",
            ]
            with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as process:
                try:
                    shutil.copyfileobj(process.stdout, compressed)
                except BaseException:
                    process.kill()
                    raise
                if process.wait() != 0:
                    raise RuntimeError(ERRORS["POSTGRES_DUMP"])
        with gzip.open(temporary, "rb") as stream:
            if not stream.read(1):
                raise RuntimeError(ERRORS["POSTGRES_EMPTY"])
            while stream.read(1024 * 1024):
                pass
        temporary.replace(archive)
    finally:
        temporary.unlink(missing_ok=True)


def cleanup(now):
    cutoff = now.timestamp() - RETENTION_DAYS * 86400
    for path in ROOT.iterdir():
        if re.fullmatch(r"\d{8}T\d{6}Z-[0-9a-f]{32}\.sql\.gz", path.name):
            if path.is_file() and not path.is_symlink() and path.stat().st_mtime < cutoff:
                path.unlink()


def backup():
    os.umask(0o077)
    s3 = storage.S3()
    ident = storage.container("projekt_postgres")
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    ROOT.chmod(0o700)
    now = dt.datetime.now(dt.timezone.utc)
    archive = ROOT / f"{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex}.sql.gz"
    snapshot(ident, archive)

    # Bei Upload- oder Prüffehlern bleibt die lokale Sicherung erhalten.
    s3.upload_verified(archive, PREFIX + archive.name)
    cleanup(now)
    print("PostgreSQL-Sicherung hochgeladen, zurückgelesen und per Prüfsumme verifiziert.")


def main():
    try:
        backup()
    except BaseException:
        storage.backup_metric(False, "postgres")
        raise
    storage.backup_metric(True, "postgres")
