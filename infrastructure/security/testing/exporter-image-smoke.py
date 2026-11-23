"""Isolierte Funktionsprüfung des aktualisierten Container-Images."""

import subprocess
import sys
import time
import uuid

from errors.messages import ERRORS


PORTS = {
    "node": 9100,
    "postgres": 9187,
    "redis": 9121,
    "nginx": 9113,
}


def check(kind, image):
    port = PORTS[kind]
    name = "projekt-exporter-check-" + uuid.uuid4().hex
    subprocess.run(
        [
            "docker",
            "pull",
            "curlimages/curl:8.17.0",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
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
    args = [
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "--network",
        "none",
    ]
    if kind == "postgres":
        args += [
            "-e",
            "DATA_SOURCE_NAME=postgresql://fixture:fixture@127.0.0.1:1/fixture?sslmode=disable&connect_timeout=1",
        ]
    args += [image]
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
    try:
        for attempt in range(15):
            result = subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--network",
                    "container:" + name,
                    "curlimages/curl:8.17.0",
                    "--silent",
                    "--show-error",
                    "--fail",
                    "--max-time",
                    "5",
                    f"http://127.0.0.1:{port}/metrics",
                ],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0 and "# HELP" in result.stdout and "_build_info{" in result.stdout:
                print(kind + ": Versions- und Metrikprüfung erfolgreich.")
                return
            time.sleep(1)
        subprocess.run(
            [
                "docker",
                "logs",
                name,
            ],
            check=False,
        )
        raise RuntimeError(kind + ERRORS["metrics_missing"])
    finally:
        subprocess.run(
            [
                "docker",
                "rm",
                "-f",
                name,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )


if __name__ == "__main__":
    check(*sys.argv[1:])
