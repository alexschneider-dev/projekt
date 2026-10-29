import sys
from pathlib import Path
import importlib.util
import json
import tempfile
import time
import urllib.parse
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


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "loki_test",
    Path(__file__).with_name("test-loki-query-integration.py"),
)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
command, request = helper.command, helper.request

CASES = [
    (
        "grafana",
        'logger=context level=error msg="Error writing to response" err="write tcp 10.0.1.11:3000->10.0.1.17:48298: write: broken pipe"',
        "response_peer_closed",
    ),
    (
        "grafana",
        'logger=context level=error msg="Error writing to response" err="write tcp 10.0.1.11:3000->10.0.1.17:48294: write: connection reset by peer"',
        "response_peer_closed",
    ),
    (
        "grafana",
        'logger=context level=error msg="Error writing to response" err="write tcp 10.0.1.11:3000->10.0.1.17:48294: write: i/o timeout"',
        None,
    ),
    (
        "grafana",
        'logger=context level=error msg="Request Completed" status=500',
        None,
    ),
    (
        "grafana",
        'logger=database level=error msg="Error writing to response" err="write tcp 10.0.1.11:3000->10.0.1.17:48294: write: broken pipe"',
        None,
    ),
    (
        "nextjs",
        'logger=context level=error msg="Error writing to response" err="write tcp 10.0.1.11:3000->10.0.1.17:48294: write: broken pipe"',
        None,
    ),
    (
        "grafana",
        'logger=context level=error msg="Failed to get settings" err="connection reset by peer"',
        None,
    ),
    (
        "loki",
        'level=error caller=scheduler_processor.go:110 msg="error processing requests from scheduler" err="rpc error: code = Canceled desc = context canceled"',
        "canceled",
    ),
    (
        "loki",
        'level=error caller=parallel_chunk_fetch.go:74 msg="error fetching chunks" err="failed to get s3 object: canceled, context canceled"',
        "canceled",
    ),
    (
        "loki",
        'level=error caller=parallel_chunk_fetch.go:74 msg="error fetching chunks" err="failed to get s3 object: operation error S3: GetObject, https response error StatusCode: 0, RequestID: , HostID: , canceled, context canceled"',
        "canceled",
    ),
    (
        "loki",
        'level=error caller=errors.go:26 message="closing iterator" error="context canceled"',
        "canceled",
    ),
    (
        "grafana",
        'logger=plugin.loki level=error msg="Partial data response error" error="Get \\"http://loki:3100/query\\": context canceled" status=500',
        "canceled",
    ),
    (
        "loki",
        'level=error caller=scheduler_processor.go:172 msg="error notifying scheduler about finished query" err=EOF addr=127.0.0.1:9095',
        "scheduler_stream_closed",
    ),
    (
        "loki",
        'level=error caller=parallel_chunk_fetch.go:74 msg="error fetching chunks" err="AccessDenied: status 403"',
        None,
    ),
    (
        "loki",
        'level=error caller=scheduler_processor.go:110 msg="error processing requests from scheduler" err="context deadline exceeded"',
        None,
    ),
    (
        "loki",
        'level=error caller=other.go:10 msg="unexpected EOF" err=EOF',
        None,
    ),
    (
        "nextjs",
        'level=error caller=errors.go:26 error="context canceled"',
        None,
    ),
    (
        "grafana",
        'logger=plugin.loki level=error msg="Partial data response error" error="connection refused"',
        None,
    ),
    (
        "grafana",
        'logger=plugin.prometheus level=error msg="Partial data response error" error="context canceled"',
        None,
    ),
    (
        "loki",
        'level=error caller=scheduler_processor.go:110 msg="query contains context canceled" err="connection refused"',
        None,
    ),
]


def main():
    stack = yaml.safe_load(
        (ROOT / "production/observability/compose.swarm.yml").read_text()
    )
    source = (ROOT / "production/observability/alloy.alloy").read_text()
    process = source[
        source.index('loki.process "classify" {') : source.index('loki.write "local" {')
    ]
    with tempfile.TemporaryDirectory(
        dir=ROOT,
        prefix=".query-classification-",
    ) as tmp:
        directory = Path(tmp)
        targets = []
        for i, (
            service,
            line,
            _,
        ) in enumerate(CASES):
            (directory / f"{i}.log").write_text(line + "\n")
            targets.append(
                '{__path__ = "/fixture/'
                + str(i)
                + '.log", service_name = "'
                + service
                + '", environment = "production", fixture = "'
                + str(i)
                + '"}'
            )
        config = (
            'loki.source.file "fixture" {\n targets = ['
            + ",\n".join(targets)
            + "]\n forward_to = [loki.process.classify.receiver]\n}\n"
        )
        config += (
            process
            + '\nloki.write "local" {\n endpoint {\n url = "http://127.0.0.1:3100/loki/api/v1/push"\n batch_wait = "100ms"\n }\n}\n'
        )
        (directory / "config.alloy").write_text(config)
        (directory / "loki.yml").write_text(yaml.safe_dump(helper.local_config()))
        containers = []
        try:
            command(
                "docker",
                "run",
                "--rm",
                "-v",
                f"{directory}:/fixture:ro",
                stack["services"]["alloy"]["image"],
                "validate",
                "/fixture/config.alloy",
            )
            loki = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--user",
                "0:0",
                "-p",
                "127.0.0.1::3100",
                "-v",
                f"{directory}/loki.yml:/config.yml:ro",
                stack["services"]["loki"]["image"],
                "-config.file=/config.yml",
            )
            containers.append(loki)
            base = (
                "http://127.0.0.1:"
                + command(
                    "docker",
                    "port",
                    loki,
                    "3100/tcp",
                ).split(
                    ":"
                )[-1]
            )
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
                raise AssertionError(ERRORS["E16"])
            alloy = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--network",
                f"container:{loki}",
                "-v",
                f"{directory}:/fixture:ro",
                stack["services"]["alloy"]["image"],
                "run",
                "--storage.path=/tmp/alloy",
                "/fixture/config.alloy",
            )
            containers.append(alloy)

            def query(expr):
                _, body = request(
                    base,
                    "/loki/api/v1/query_range?"
                    + urllib.parse.urlencode(
                        {
                            "query": expr,
                            "start": str(time.time_ns() - 300 * 10**9),
                            "end": str(time.time_ns()),
                            "limit": 1000,
                        }
                    ),
                )
                return json.loads(body)["data"]["result"]

            for _ in range(30):
                result = query('{fixture=~".+"}')
                if sum(len(s["values"]) for s in result) == len(CASES):
                    break
                time.sleep(1)
            else:
                raise AssertionError(
                    command(
                        "docker",
                        "logs",
                        alloy,
                        include_stderr=True,
                    )
                )
            for stream in result:
                service, line, expected = CASES[int(stream["stream"]["fixture"])]
                assert stream["stream"].get("query_event") == expected, stream
                assert (
                    stream["values"][0][1] == line
                ), "Die ursprüngliche Logzeile wurde verändert."
            for environment in ["production"]:
                panels = json.loads(
                    (
                        ROOT / f"{environment}/observability/grafana/overview.json"
                    ).read_text()
                )["panels"]
                error = next(p for p in panels if p["id"] == 102)["targets"][0]["expr"]
                diagnostic = next(
                    p for p in panels if p["title"].startswith("Abfrageabbrüche")
                )["targets"][0]["expr"]

                def fixtures(expr):
                    expr = expr.replace(
                        "${service:regex}",
                        ".+",
                    ).replace(
                        'environment="development"',
                        'environment="production"',
                    )
                    return {int(s["stream"]["fixture"]) for s in query(expr)}

                assert fixtures(error) == {
                    i for i, c in enumerate(CASES) if c[2] is None
                }
                assert fixtures(diagnostic) == {
                    i for i, c in enumerate(CASES) if c[2] is not None
                }
            print(
                "Erfolgreich: Rohlogs erhalten, Abbrüche klassifiziert und echte Fehler sichtbar."
            )
        finally:
            for cid in reversed(containers):
                command(
                    "docker",
                    "rm",
                    "-f",
                    cid,
                )


if __name__ == "__main__":
    main()
