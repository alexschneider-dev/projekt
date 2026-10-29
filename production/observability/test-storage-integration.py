import sys
from pathlib import Path
import json
import os
import subprocess
import tempfile
import time
import yaml


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


HERE = Path(__file__).resolve().parent
PROJECT = "projekt-storage-test"
PYTHON_IMAGE = "python:3.13.9-alpine3.22"


def command(*args):
    return subprocess.check_output(
        args,
        text=True,
        stderr=subprocess.PIPE,
    ).strip()


def cleanup_test_files(root):
    root = Path(root).resolve()
    if root.parent != HERE or not root.name.startswith(".storage-test-"):
        raise ValueError(ERRORS["E14"])
    command(
        "docker",
        "run",
        "--rm",
        "--network",
        "none",
        "--user",
        "0:0",
        "--mount",
        f"type=bind,src={root},dst=/test",
        PYTHON_IMAGE,
        "python",
        "-c",
        "from pathlib import Path; import shutil; "
        "[(shutil.rmtree(p) if p.is_dir() and not p.is_symlink() else p.unlink()) "
        'for p in Path("/test").iterdir()]',
    )
    if any(root.iterdir()):
        raise RuntimeError(ERRORS["E15"])


def main():
    with tempfile.TemporaryDirectory(
        prefix=".storage-test-",
        dir=HERE,
    ) as tmp:
        root = Path(tmp)
        (root / "prom-data").mkdir()
        (root / "prom-data").chmod(0o777)
        now = int(time.time())
        (root / "samples.txt").write_text(
            f"# TYPE storage_restore_probe gauge\nstorage_restore_probe 42 {now-10800}\nstorage_restore_probe 43 {now-7201}\n# EOF\n"
        )
        (root / "prometheus.yml").write_text(
            'global:\n  external_labels:\n    environment: production\nscrape_configs:\n  - job_name: prometheus\n    static_configs:\n      - targets: ["prometheus:9090"]\n'
        )
        (root / "s3.json").write_text(
            json.dumps(
                {
                    "type": "S3",
                    "prefix": "projekt/production/metrics",
                    "config": {
                        "bucket": "monitoring-test",
                        "endpoint": "s3:5000",
                        "access_key": "test",
                        "secret_key": "test",
                        "region": "us-east-1",
                        "insecure": True,
                        "bucket_lookup_type": "path",
                    },
                }
            )
        )
        (root / "credentials").write_text(
            "[default]\naws_access_key_id = test\naws_secret_access_key = test\n"
        )
        tempo = yaml.safe_load((HERE / "tempo.yml").read_text())
        tempo["storage"]["trace"]["s3"].update(
            bucket="monitoring-test",
            endpoint="s3:5000",
            region="us-east-1",
            insecure=True,
        )
        (root / "tempo.yml").write_text(yaml.safe_dump(tempo))
        prod = yaml.safe_load((HERE / "compose.swarm.yml").read_text())["services"]
        services = {
            "s3": {
                "image": "motoserver/moto:5.1.15",
                "volumes": [f"{root}:/test"],
            }
        }
        for name, folder in [
            (
                "grafana",
                "grafana-data",
            ),
            (
                "grafana-restored",
                "restore",
            ),
        ]:
            (root / folder).mkdir()
            services[name] = {
                "image": prod["grafana"]["image"],
                "user": "0:0",
                "volumes": [
                    f"{root}/{folder}:/var/lib/grafana",
                    f"{HERE}/grafana/error.html:/usr/share/grafana/public/views/error.html:ro",
                ],
            }
        for name in [
            "prometheus",
            "thanos-sidecar",
            "thanos-store",
            "thanos-query",
            "thanos-compact",
            "tempo",
        ]:
            service = prod[name]
            services[name] = {
                "image": service["image"],
                "user": "0:0",
                "command": service["command"],
                "volumes": [],
                "mem_limit": service["deploy"]["resources"]["limits"]["memory"],
            }
            if name.startswith("thanos-") and name != "thanos-query":
                services[name]["volumes"].append(
                    f"{root}/s3.json:/run/secrets/thanos_s3:ro"
                )
            if name in [
                "prometheus",
                "thanos-sidecar",
            ]:
                services[name]["volumes"].append(f"{root}/prom-data:/prometheus")
            if name == "prometheus":
                services[name]["volumes"].append(
                    f"{root}/prometheus.yml:/etc/prometheus/prometheus.yml:ro"
                )
            if name == "tempo":
                services[name]["environment"] = {
                    "AWS_SHARED_CREDENTIALS_FILE": "/credentials",
                    "AWS_EC2_METADATA_DISABLED": "true",
                }
                services[name]["volumes"] += [
                    f"{root}/tempo.yml:/etc/tempo/config.yml:ro",
                    f"{root}/credentials:/credentials:ro",
                ]
        services["archive-query"] = {
            "image": prod["thanos-query"]["image"],
            "command": [
                "query",
                "--http-address=0.0.0.0:10902",
                "--endpoint=thanos-store:10901",
                "--no-query.partial-response",
            ],
        }
        compose = root / "compose.yml"
        compose.write_text(yaml.safe_dump({"services": services}))

        def dc(*args):
            return command(
                "docker",
                "compose",
                "-p",
                PROJECT,
                "-f",
                str(compose),
                *args,
            )

        def remote(code):
            return dc(
                "exec",
                "-T",
                "s3",
                "python",
                "-c",
                code,
            )

        def request(
            url,
            body=None,
        ):
            return remote(
                "import urllib.request; "
                + f'r=urllib.request.Request({url!r}, data={body!r}, headers={{"Content-Type":"application/json"}}); print(urllib.request.urlopen(r,timeout=10).read().decode())'
            )

        def retry(
            fn,
            timeout=120,
        ):
            end = time.monotonic() + timeout
            while True:
                try:
                    return fn()
                except (
                    subprocess.CalledProcessError,
                    AssertionError,
                    KeyError,
                ):
                    if time.monotonic() > end:
                        raise
                    time.sleep(3)

        try:
            dc(
                "up",
                "-d",
                "s3",
            )
            retry(
                lambda: remote(
                    "import boto3; boto3.client('s3',endpoint_url='http://localhost:5000',aws_access_key_id='test',aws_secret_access_key='test',region_name='us-east-1').create_bucket(Bucket='monitoring-test')"
                )
            )
            command(
                "docker",
                "run",
                "--rm",
                "--user",
                "0:0",
                "--entrypoint",
                "/bin/promtool",
                "-v",
                f"{root}:/test",
                prod["prometheus"]["image"],
                "tsdb",
                "create-blocks-from",
                "openmetrics",
                "/test/samples.txt",
                "/test/prom-data",
            )
            dc(
                "up",
                "-d",
                "prometheus",
            )
            retry(lambda: request("http://prometheus:9090/-/ready"))
            dc(
                "up",
                "-d",
                "thanos-sidecar",
                "thanos-store",
                "thanos-query",
                "thanos-compact",
                "tempo",
                "archive-query",
                "grafana",
            )
            for service in [
                "thanos-sidecar",
                "thanos-store",
                "thanos-query",
                "thanos-compact",
            ]:
                retry(
                    lambda service=service: request(f"http://{service}:10902/-/ready")
                )

            def archive_read():
                result = json.loads(
                    request(
                        f"http://archive-query:10902/api/v1/query?query=storage_restore_probe&time={now-10800}"
                    )
                )
                assert result.get("status") == "success" and not result.get(
                    "warnings"
                ), result
                assert result["data"]["result"], result
                assert result["data"]["result"][0]["value"][1] == "42", result

            def uploaded():
                data = remote(
                    "import boto3; s=boto3.client('s3',endpoint_url='http://localhost:5000',aws_access_key_id='test',aws_secret_access_key='test'); print([o['Key'] for o in s.list_objects_v2(Bucket='monitoring-test',Prefix='projekt/production/metrics/').get('Contents',[])])"
                )
                assert "meta.json" in data, data

            retry(uploaded)
            dc(
                "restart",
                "thanos-store",
            )
            retry(archive_read)
            print(
                "Erfolgreich: Historischer Prometheus-Block über S3 gespeichert und gelesen."
            )
            trace = "1234567890abcdef1234567890abcdef"
            start = str(int(time.time() * 1e9))
            body = json.dumps(
                {
                    "resourceSpans": [
                        {
                            "resource": {
                                "attributes": [
                                    {
                                        "key": "service.name",
                                        "value": {"stringValue": "storage-test"},
                                    }
                                ]
                            },
                            "scopeSpans": [
                                {
                                    "spans": [
                                        {
                                            "traceId": trace,
                                            "spanId": "1234567890abcdef",
                                            "name": "storage-roundtrip",
                                            "kind": 1,
                                            "startTimeUnixNano": start,
                                            "endTimeUnixNano": str(
                                                int(start) + 1000000
                                            ),
                                        }
                                    ]
                                }
                            ],
                        }
                    ]
                }
            ).encode()
            retry(
                lambda: request(
                    "http://tempo:4318/v1/traces",
                    body,
                )
            )
            request(
                "http://tempo:3200/flush",
                b"",
            )

            def tempo_uploaded():
                data = remote(
                    "import boto3; s=boto3.client('s3',endpoint_url='http://localhost:5000',aws_access_key_id='test',aws_secret_access_key='test'); print([o['Key'] for o in s.list_objects_v2(Bucket='monitoring-test',Prefix='projekt/production/tempo/').get('Contents',[])])"
                )
                assert "meta.json" in data, data

            retry(tempo_uploaded)
            dc(
                "up",
                "-d",
                "--force-recreate",
                "tempo",
            )
            retry(lambda: request("http://tempo:3200/api/traces/" + trace))
            print(
                "Erfolgreich: Tempo-Trace nach Containerwechsel aus S3 wiederhergestellt."
            )
            retry(lambda: request("http://grafana:3000/api/health"))

            def grafana_api(
                host,
                path,
                body=None,
            ):
                return remote(
                    "import urllib.request,base64; "
                    + f'r=urllib.request.Request("http://{host}:3000"+{path!r}, data={body!r}, headers={{"Content-Type":"application/json","Authorization":"Basic "+base64.b64encode(b"admin:admin").decode()}}); print(urllib.request.urlopen(r,timeout=15).read().decode())'
                )

            dashboard = json.dumps(
                {
                    "dashboard": {
                        "uid": "restore-test",
                        "title": "S3 restore acceptance",
                        "schemaVersion": 39,
                        "panels": [],
                    }
                }
            ).encode()
            grafana_api(
                "grafana",
                "/api/dashboards/db",
                dashboard,
            )
            (root / "snapshot").mkdir()
            command(
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                "--user",
                "0:0",
                "-v",
                f"{root}/grafana-data:/grafana",
                "-v",
                f"{root}/snapshot:/work",
                "-v",
                f"{HERE}/backup/snapshot.py:/snapshot.py:ro",
                "-v",
                f"{HERE}/errors/messages.py:/messages.py:ro",
                PYTHON_IMAGE,
                "python",
                "/snapshot.py",
                prod["grafana"]["image"],
            )
            remote(
                "import boto3,hashlib,tarfile,sqlite3; from pathlib import Path; s=boto3.client('s3',endpoint_url='http://localhost:5000',aws_access_key_id='test',aws_secret_access_key='test'); s.upload_file('/test/snapshot/grafana.tar.gz','monitoring-test','projekt/production/grafana-backups/daily/test.tar.gz'); s.download_file('monitoring-test','projekt/production/grafana-backups/daily/test.tar.gz','/test/download.tar.gz'); assert hashlib.sha256(Path('/test/download.tar.gz').read_bytes()).digest()==hashlib.sha256(Path('/test/snapshot/grafana.tar.gz').read_bytes()).digest(); t=tarfile.open('/test/download.tar.gz'); t.extractall('/test/restore',filter='data'); assert sqlite3.connect('/test/restore/grafana.db').execute('PRAGMA integrity_check').fetchone()==('ok',)"
            )
            dc(
                "up",
                "-d",
                "grafana-restored",
            )
            retry(lambda: request("http://grafana-restored:3000/api/health"))
            recovered = json.loads(
                grafana_api(
                    "grafana-restored",
                    "/api/dashboards/uid/restore-test",
                )
            )
            assert recovered["dashboard"]["title"] == "S3 restore acceptance", recovered
            print(
                "Erfolgreich: Grafana-Sicherung hochgeladen, zurückgelesen und mit Dashboard wiederhergestellt."
            )

        except BaseException:
            print(
                dc(
                    "logs",
                    "--tail",
                    "40",
                )
            )
            raise
        finally:
            dc(
                "down",
                "--volumes",
                "--remove-orphans",
            )
            cleanup_test_files(root)
            print("Erfolgreich: Temporäre Testdateien bereinigt.")


if __name__ == "__main__":
    main()
