import sys
from pathlib import Path
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


ROOT = Path("/etc/projekt/monitoring-storage")
PREFIX = "projekt/production/grafana-backups/"
PYTHON_IMAGE = "python:3.13.9-alpine3.22"
HERE = Path(__file__).resolve().parent


def run(
    *args,
    **kw,
):
    return subprocess.check_output(
        list(args),
        text=True,
        **kw,
    ).strip()


def docker(*args):
    return run(
        "docker",
        *args,
    )


def container(service):
    ids = docker(
        "ps",
        "-q",
        "--filter",
        f"label=com.docker.swarm.service.name={service}",
        "--filter",
        "status=running",
    ).splitlines()
    if len(ids) != 1:
        raise RuntimeError(ERRORS["CONTAINER"].format(service=service))
    return ids[0]


def settings():
    endpoint = os.environ["LOKI_S3_ENDPOINT"].rstrip("/")
    if not re.fullmatch(
        r"https://[a-zA-Z0-9.-]+(?::[0-9]+)?",
        endpoint,
    ):
        raise ValueError(ERRORS["E5"])
    return {
        "endpoint": endpoint,
        "bucket": os.environ["LOKI_S3_BUCKET"],
        "region": os.environ["LOKI_S3_REGION"],
    }


class S3:
    def __init__(self):
        self.cfg = settings()
        revision = os.environ["OBS_SECRET_REVISION"]
        if not re.fullmatch(
            r"[a-z0-9-]{1,24}",
            revision,
        ):
            raise ValueError(ERRORS["E7"])
        self.secret = f"projekt_obs_loki_s3_credentials_{revision}"
        self.image = os.environ["AWS_CLI_IMAGE"]
        self.node = docker(
            "info",
            "--format",
            "{{.Swarm.NodeID}}",
        )
        docker(
            "secret",
            "inspect",
            self.secret,
        )
        ROOT.mkdir(
            mode=0o700,
            parents=True,
            exist_ok=True,
        )
        ROOT.chmod(0o700)

    def aws(
        self,
        *args,
        mounts=(),
    ):
        # Nur Swarm-Tasks können Secrets erhalten; keine Kopie auf die Host-Platte.
        name = "projekt-monitoring-s3-" + os.urandom(8).hex()
        try:
            docker(
                "service",
                "create",
                "--detach=true",
                "--name",
                name,
                "--constraint",
                f"node.id=={self.node}",
                "--restart-condition",
                "none",
                "--limit-memory",
                "256M",
                "--log-driver",
                "json-file",
                "--log-opt",
                "max-size=1m",
                "--log-opt",
                "max-file=1",
                "--entrypoint",
                "aws",
                "--secret",
                f"source={self.secret},target=s3_credentials",
                "--env",
                "AWS_SHARED_CREDENTIALS_FILE=/run/secrets/s3_credentials",
                "--env",
                f'AWS_DEFAULT_REGION={self.cfg["region"]}',
                "--env",
                "AWS_EC2_METADATA_DISABLED=true",
                "--env",
                "AWS_PAGER=",
                *mounts,
                self.image,
                "--endpoint-url",
                self.cfg["endpoint"],
                *args,
            )
            deadline = time.monotonic() + 300
            while time.monotonic() < deadline:
                task = docker(
                    "service",
                    "ps",
                    "--no-trunc",
                    "-q",
                    name,
                )
                if task:
                    if len(task.splitlines()) != 1:
                        raise RuntimeError(ERRORS["S3_TASK"])
                    status = json.loads(
                        docker(
                            "inspect",
                            "--type",
                            "task",
                            task,
                            "--format",
                            "{{json .Status}}",
                        )
                    )
                    state = status["State"]
                    if state == "complete":
                        if (
                            status.get(
                                "ContainerStatus",
                                {},
                            ).get("ExitCode")
                            != 0
                        ):
                            raise RuntimeError(ERRORS["S3_TASK"])
                        return docker(
                            "service",
                            "logs",
                            "--raw",
                            "--no-task-ids",
                            "--no-resolve",
                            name,
                        )
                    if state in [
                        "failed",
                        "rejected",
                        "shutdown",
                        "orphaned",
                        "remove",
                    ]:
                        raise RuntimeError(ERRORS["S3_TASK"])
                time.sleep(1)
            raise RuntimeError(ERRORS["S3_TIMEOUT"])
        finally:
            docker(
                "service",
                "rm",
                name,
            )

    def objects(
        self,
        prefix,
    ):
        return json.loads(
            self.aws(
                "s3api",
                "list-objects-v2",
                "--bucket",
                self.cfg["bucket"],
                "--prefix",
                prefix,
                "--output",
                "json",
            )
        ).get(
            "Contents",
            [],
        )

    def upload_verified(
        self,
        path,
        key,
    ):
        path = Path(path)
        with tempfile.TemporaryDirectory(
            prefix="verify-",
            dir=ROOT,
        ) as tmp:
            mounts = (
                "--mount",
                f"type=bind,src={path.parent},dst=/source,readonly",
                "--mount",
                f"type=bind,src={tmp},dst=/verify",
            )
            uri = f's3://{self.cfg["bucket"]}/{key}'
            self.aws(
                "s3",
                "cp",
                f"/source/{path.name}",
                uri,
                "--only-show-errors",
                mounts=mounts,
            )
            self.aws(
                "s3",
                "cp",
                uri,
                "/verify/object",
                "--only-show-errors",
                mounts=mounts,
            )
            if digest(path) != digest(Path(tmp) / "object"):
                raise RuntimeError(ERRORS["E6"])


def digest(path):
    with Path(path).open("rb") as stream:
        checksum = hashlib.sha256()
        for chunk in iter(
            lambda: stream.read(1024 * 1024),
            b"",
        ):
            checksum.update(chunk)
        return checksum.hexdigest()


def expired_keys(
    keys,
    today,
):
    month_index = today.year * 12 + today.month - 1
    for key in keys:
        match = re.fullmatch(
            re.escape(PREFIX) + r"(daily|monthly)/(\d{4}-\d{2}(?:-\d{2})?)\.tar\.gz",
            key,
        )
        if not match:
            continue
        kind, stamp = match.groups()
        try:
            if kind == "daily":
                date = dt.date.fromisoformat(stamp)
                expired = date < today - dt.timedelta(days=29)
            else:
                if len(stamp) != 7:
                    continue
                date = dt.date.fromisoformat(stamp + "-01")
                expired = date.year * 12 + date.month - 1 < month_index - 11
        except ValueError:
            continue
        if expired:
            yield key


def backup():
    s3 = S3()
    ident = container("observability_grafana")
    image = docker(
        "inspect",
        ident,
        "--format",
        "{{.Config.Image}}",
    )
    mounts = json.loads(
        docker(
            "inspect",
            ident,
            "--format",
            "{{json .Mounts}}",
        )
    )
    volume = next(
        m["Name"]
        for m in mounts
        if m["Destination"] == "/var/lib/grafana" and m["Type"] == "volume"
    )
    with tempfile.TemporaryDirectory(
        prefix="grafana-",
        dir=ROOT,
    ) as tmp:
        docker(
            "run",
            "--rm",
            "--network",
            "none",
            "--memory",
            "256m",
            "--mount",
            f"type=volume,src={volume},dst=/grafana",
            "--mount",
            f"type=bind,src={tmp},dst=/work",
            "--mount",
            f'type=bind,src={HERE / "snapshot.py"},dst=/snapshot.py,readonly',
            "--mount",
            f'type=bind,src={HERE.parent / "errors/messages.py"},dst=/messages.py,readonly',
            PYTHON_IMAGE,
            "python",
            "-B",
            "/snapshot.py",
            image,
        )
        today = dt.datetime.now(dt.timezone.utc).date()
        archive = Path(tmp) / "grafana.tar.gz"
        s3.upload_verified(
            archive,
            f"{PREFIX}daily/{today.isoformat()}.tar.gz",
        )
        objects = s3.objects(PREFIX)
        monthly = f"{PREFIX}monthly/{today:%Y-%m}.tar.gz"
        if monthly not in {o["Key"] for o in objects}:
            s3.upload_verified(
                archive,
                monthly,
            )
        for key in expired_keys(
            [o["Key"] for o in objects],
            today,
        ):
            s3.aws(
                "s3api",
                "delete-object",
                "--bucket",
                s3.cfg["bucket"],
                "--key",
                key,
            )
    print("Grafana-Sicherung hochgeladen, zurückgelesen und per Prüfsumme verifiziert.")


def prepare():
    cfg = settings()
    revision = os.environ["OBS_SECRET_REVISION"]
    if not re.fullmatch(
        r"[a-z0-9-]{1,24}",
        revision,
    ):
        raise ValueError(ERRORS["E7"])
    docker(
        "secret",
        "inspect",
        f"projekt_obs_thanos_s3_{revision}",
    )
    s3 = S3()
    with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
        probe = Path(tmp) / "probe"
        probe.write_text("Prüfung der Monitoring-Speicherrechte\n")
        for prefix in [
            "projekt/production/loki",
            "projekt/production/metrics",
            "projekt/production/tempo",
            PREFIX.rstrip("/"),
        ]:
            key = f"{prefix}/_permission-check/{os.urandom(12).hex()}"
            s3.upload_verified(
                probe,
                key,
            )
            s3.objects(prefix)
            s3.aws(
                "s3api",
                "delete-object",
                "--bucket",
                cfg["bucket"],
                "--key",
                key,
            )
    docker(
        "pull",
        PYTHON_IMAGE,
    )
    print("S3-Schreib-, Lese- und Löschprüfung erfolgreich; Thanos-Secret vorhanden.")


def backup_metric(success):
    code = r"""import pathlib,time,sys
p=pathlib.Path('/backup/observability/grafana-backup.prom')
p.parent.mkdir(parents=True,exist_ok=True)
old=p.read_text() if p.exists() else ''
last=next((line for line in old.splitlines() if line.startswith('grafana_backup_last_success_timestamp_seconds ')), 'grafana_backup_last_success_timestamp_seconds 0')
if sys.argv[1]=='1': last='grafana_backup_last_success_timestamp_seconds '+str(int(time.time()))
tmp=p.with_suffix('.tmp')
tmp.write_text(last+'\n'+'grafana_backup_last_run_success '+sys.argv[1]+'\n')
tmp.chmod(0o644)
tmp.replace(p)
"""
    docker(
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        "128m",
        "--mount",
        "type=volume,src=projekt_monitoring_backup,dst=/backup",
        PYTHON_IMAGE,
        "python",
        "-c",
        code,
        "1" if success else "0",
    )


def main():
    import sys

    if os.geteuid() != 0:
        raise RuntimeError(ERRORS["E8"])
    os.umask(0o077)
    action = sys.argv[1]
    if action == "backup":
        try:
            backup()
        except BaseException:
            backup_metric(False)
            raise
        backup_metric(True)
    else:
        {"prepare": prepare}[action]()


if __name__ == "__main__":
    main()
