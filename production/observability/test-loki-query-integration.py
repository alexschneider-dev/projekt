import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

import yaml


import sys


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
from messages import ERRORS


ROOT = Path(__file__).resolve().parents[2]


def command(
    *args,
    include_stderr=False,
):
    result = subprocess.run(
        args,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(
            ERRORS["COMMAND"].format(
                program=args[0],
                action=args[1],
                status=result.returncode,
                output=result.stdout + result.stderr,
            )
        )
    output = result.stdout + result.stderr if include_stderr else result.stdout
    return output.strip()


def request(
    base,
    path,
    data=None,
):
    payload = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        base + path,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(
            req,
            timeout=60,
        ) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            ERRORS["HTTP"].format(
                status=exc.code,
                body=exc.read().decode(),
            )
        ) from exc


def local_config():
    config = yaml.safe_load((ROOT / "production/observability/loki.yml").read_text())
    config["schema_config"]["configs"][0]["object_store"] = "filesystem"
    config["storage_config"] = {
        "filesystem": {"directory": "/loki/chunks"},
        "tsdb_shipper": {
            "active_index_directory": "/loki/index",
            "cache_location": "/loki/index_cache",
        },
    }
    config["compactor"]["delete_request_store"] = "filesystem"
    return config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--baseline",
        action="store_true",
    )
    args = parser.parse_args()
    production = yaml.safe_load(
        (ROOT / "production/observability/loki.yml").read_text()
    )
    config = local_config()
    config["limits_config"] = production["limits_config"]
    if args.baseline:
        config["limits_config"].pop(
            "split_queries_by_interval",
            None,
        )
    stack = yaml.safe_load(
        (ROOT / "production/observability/compose.swarm.yml").read_text()
    )
    image = stack["services"]["loki"]["image"]
    with tempfile.TemporaryDirectory(
        dir=ROOT,
        prefix=".loki-query-test-",
    ) as tmp:
        path = Path(tmp) / "config.yml"
        path.write_text(yaml.safe_dump(config))
        cid = command(
            "docker",
            "run",
            "-d",
            "--rm",
            "--user",
            "0:0",
            "-p",
            "127.0.0.1::3100",
            "-v",
            f"{path}:/etc/loki/config.yml:ro",
            image,
            "-config.file=/etc/loki/config.yml",
        )
        try:
            port = command(
                "docker",
                "port",
                cid,
                "3100/tcp",
            ).split(
                ":"
            )[-1]
            base = f"http://127.0.0.1:{port}"
            for _ in range(60):
                try:
                    if (
                        request(
                            base,
                            "/ready",
                        )[0]
                        == 200
                    ):
                        break
                except (
                    RuntimeError,
                    OSError,
                ):
                    pass
                time.sleep(1)
            else:
                raise AssertionError(
                    command(
                        "docker",
                        "logs",
                        cid,
                        include_stderr=True,
                    )
                )

            now = time.time_ns()
            values = []
            for hour in range(24):
                batch = [
                    [
                        str(now - (24 - hour) * 3600 * 10**9 + i * 10**6),
                        f"level=error synthetic {hour} {i} " + "x" * 200,
                    ]
                    for i in range(1000)
                ]
                values.extend(batch)
                assert (
                    request(
                        base,
                        "/loki/api/v1/push",
                        {
                            "streams": [
                                {
                                    "stream": {"service_name": "cancel-test"},
                                    "values": batch,
                                }
                            ]
                        },
                    )[0]
                    == 204
                )
                time.sleep(0.1)

            request(
                base,
                "/flush",
                {},
            )
            time.sleep(2)

            query_started = datetime.now(timezone.utc).isoformat()
            query = '{service_name="cancel-test"} |= "level=error"'
            for direction in [
                "backward",
                "forward",
            ]:
                for limit in [
                    1,
                    200,
                    200,
                    200,
                ]:
                    params = {
                        "query": query,
                        "start": str(now - 25 * 3600 * 10**9),
                        "end": str(now),
                        "limit": limit,
                        "direction": direction,
                    }
                    _, body = request(
                        base,
                        "/loki/api/v1/query_range?" + urllib.parse.urlencode(params),
                    )
                    result = json.loads(body)["data"]["result"]
                    actual = [v for stream in result for v in stream["values"]]
                    actual.sort(
                        key=lambda value: int(value[0]),
                        reverse=direction == "backward",
                    )
                    expected = (
                        list(reversed(values))[:limit]
                        if direction == "backward"
                        else values[:limit]
                    )
                    assert actual == expected, (
                        direction,
                        limit,
                        len(actual),
                        next(
                            (
                                (
                                    a,
                                    b,
                                )
                                for a, b in zip(
                                    actual,
                                    expected,
                                )
                                if a != b
                            ),
                            None,
                        ),
                    )

            _, body = request(
                base,
                "/loki/api/v1/query?"
                + urllib.parse.urlencode(
                    {
                        "query": 'sum(count_over_time({service_name="cancel-test"}[25h]))',
                        "time": str(now),
                    }
                ),
            )
            assert float(json.loads(body)["data"]["result"][0]["value"][1]) == len(
                values
            )
            time.sleep(1)
            logs = command(
                "docker",
                "logs",
                "--since",
                query_started,
                cid,
                include_stderr=True,
            )
            errors = [
                line
                for line in logs.splitlines()
                if re.search(
                    r"(?:^|\s)level=(error|fatal)\b",
                    line,
                )
            ]
            assert not errors, "\n".join(errors)
            print(
                "Erfolgreich: 24-Stunden-Logsuche, Zeilenlimits, beide Richtungen und Metrikzählung ohne Loki-Fehler."
            )
        finally:
            command(
                "docker",
                "rm",
                "-f",
                cid,
            )


if __name__ == "__main__":
    main()
