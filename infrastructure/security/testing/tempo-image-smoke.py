"""Isolierte Funktionsprüfung des aktualisierten Container-Images."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid

from errors.messages import ERRORS


CONFIG = """server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 127.0.0.1:4318
ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
storage:
  trace:
    backend: local
    wal:
      path: /var/tempo/wal
    local:
      path: /var/tempo/blocks
"""


def check(image):
    name = "projekt-tempo-check-" + uuid.uuid4().hex
    subprocess.run(
        [
            "docker",
            "pull",
            "curlimages/curl:8.17.0",
        ],
        check=True,
    )
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            image,
            "-version",
        ],
        check=True,
    )
    subprocess.run(
        [
            "docker",
            "create",
            "--name",
            name,
            "--network",
            "none",
            "--tmpfs",
            "/var/tempo:rw,size=128m,uid=10001,gid=10001,mode=0700",
            image,
            "-config.file=/tmp/security-fixture.yml",
        ],
        check=True,
    )
    try:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "config.yml"
            p.write_text(CONFIG)
            p.chmod(0o644)
            subprocess.run(
                [
                    "docker",
                    "cp",
                    str(p),
                    name + ":/tmp/security-fixture.yml",
                ],
                check=True,
            )
        subprocess.run(
            [
                "docker",
                "start",
                name,
            ],
            check=True,
        )

        def request(port, path, body=None):
            args = [
                "docker",
                "run",
                "--rm",
                "--network",
                "container:" + name,
                "curlimages/curl:8.17.0",
                "-fsS",
                "--max-time",
                "5",
                "-H",
                "Accept: application/json",
                f"http://127.0.0.1:{port}/{path}",
            ]
            if body is not None:
                args += [
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    json.dumps(body),
                ]
            return subprocess.check_output(args, text=True)

        for _ in range(60):
            running = subprocess.check_output(
                [
                    "docker",
                    "inspect",
                    "--format",
                    "{{.State.Running}}",
                    name,
                ],
                text=True,
            ).strip()
            if running != "true":
                raise RuntimeError(ERRORS["tempo_exited"])
            try:
                request(3200, "ready")
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError(ERRORS["tempo_not_ready"])
        trace = uuid.uuid4().hex
        now = time.time_ns()
        request(
            4318,
            "v1/traces",
            {
                "resourceSpans": [
                    {
                        "scopeSpans": [
                            {
                                "spans": [
                                    {
                                        "traceId": trace,
                                        "spanId": uuid.uuid4().hex[:16],
                                        "name": "security-fixture",
                                        "kind": 1,
                                        "startTimeUnixNano": str(now),
                                        "endTimeUnixNano": str(now + 1000000),
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
        )
        for _ in range(20):
            try:
                if "security-fixture" in request(3200, "api/traces/" + trace):
                    print("Isolierte Funktionsprüfung erfolgreich.")
                    return
            except subprocess.CalledProcessError:
                pass
            time.sleep(1)
        raise RuntimeError(ERRORS["trace_missing"])
    except Exception:
        subprocess.run(
            [
                "docker",
                "logs",
                "--tail",
                "100",
                name,
            ],
            check=False,
        )
        raise
    finally:
        subprocess.run(
            [
                "docker",
                "rm",
                "-fv",
                name,
            ],
            check=True,
        )


if __name__ == "__main__":
    check(sys.argv[1])
