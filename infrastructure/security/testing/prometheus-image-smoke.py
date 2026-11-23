"""Isolierte Funktionsprüfung des aktualisierten Container-Images."""

import json
import subprocess
import sys
import time
import uuid

from errors.messages import ERRORS


def check(image):
    name = "projekt-prometheus-check-" + uuid.uuid4().hex
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            image,
            "--version",
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
            "--entrypoint",
            "/bin/promtool",
            image,
            "check",
            "config",
            "/etc/prometheus/prometheus.yml",
        ],
        check=True,
    )
    subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            name,
            "--network",
            "none",
            image,
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/tmp/security-fixture",
        ],
        check=True,
    )

    def get(path):
        return subprocess.check_output(
            [
                "docker",
                "exec",
                name,
                "wget",
                "-qO-",
                "http://127.0.0.1:9090/" + path,
            ],
            text=True,
        )

    try:
        for _ in range(30):
            try:
                if "Ready" in get("-/ready"):
                    break
            except subprocess.CalledProcessError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError(ERRORS["prometheus_not_ready"])
        result = json.loads(get("api/v1/query?query=vector%281%29"))
        assert result["status"] == "success"
        assert result["data"]["result"][0]["value"][1] == "1"
        assert "<html" in get("query").lower()
        print("Isolierte Funktionsprüfung erfolgreich.")
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
