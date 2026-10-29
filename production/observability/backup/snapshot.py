import sys
from pathlib import Path
import datetime
import json
import pathlib
import sqlite3
import tarfile


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


def snapshot(
    source,
    output,
    metadata,
):
    source, output = pathlib.Path(source), pathlib.Path(output)
    db = output / "grafana.db"
    with sqlite3.connect(
        (source / "grafana.db").as_uri() + "?mode=ro",
        uri=True,
        timeout=30,
    ) as live, sqlite3.connect(db) as copy:
        live.backup(
            copy,
            pages=256,
            sleep=0.1,
        )
        if copy.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise RuntimeError(ERRORS["E4"])
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "grafana_image": metadata,
                "restore_requires": "Passende Provisionierung, Laufzeiteinstellungen und Swarm Secrets",
            },
            indent=2,
        )
    )
    with tarfile.open(
        output / "grafana.tar.gz",
        "w:gz",
    ) as archive:
        archive.add(
            db,
            arcname="grafana.db",
        )
        archive.add(
            output / "manifest.json",
            arcname="manifest.json",
        )
        plugins = source / "plugins"
        if plugins.exists():
            archive.add(
                plugins,
                arcname="plugins",
            )
    with tarfile.open(
        output / "grafana.tar.gz",
        "r:gz",
    ) as archive:
        for member in archive:
            if member.isfile():
                with archive.extractfile(member) as stream:
                    while stream.read(1024 * 1024):
                        pass


if __name__ == "__main__":
    import sys

    snapshot(
        "/grafana",
        "/work",
        sys.argv[1],
    )
