"""Isolierte Funktionsprüfung des aktualisierten Container-Images."""

import json
import subprocess
import sys
import time
import uuid

from errors.messages import ERRORS


def check(image):
    name = "projekt-thanos-check-" + uuid.uuid4().hex
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
            "-d",
            "--name",
            name,
            "--network",
            "none",
            image,
            "query",
            "--http-address=127.0.0.1:10902",
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
                "http://127.0.0.1:10902/" + path,
            ],
            text=True,
        )

    try:
        for _ in range(30):
            try:
                get("-/ready")
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError(ERRORS["thanos_not_ready"])
        for query in [
            "vector%2842%29",
            "sum%28vector%2842%29%29",
        ]:
            result = json.loads(get("api/v1/query?query=" + query))
            assert result["status"] == "success" and not result.get("warnings"), result
            assert result["data"]["result"][0]["value"][1] == "42", result
        assert "<html" in get("graph").lower()
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
