"""Prüft Jahresauswertungen und den Weg von Loki-Aufzeichnungen nach Prometheus."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import urllib.parse

import yaml


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("loki_test", HERE / "test-loki-query-integration.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
command = helper.command
request = helper.request


def query(base, expression, timestamp):
    params = {
        "query": expression,
        "time": str(timestamp),
    }
    _, body = request(base, "/api/v1/query?" + urllib.parse.urlencode(params))
    payload = json.loads(body)
    assert payload["status"] == "success", payload
    return payload["data"]["result"]


def ready(base, path):
    for _ in range(90):
        try:
            if request(base, path)[0] == 200:
                return
        except (OSError, RuntimeError):
            pass
        time.sleep(1)
    assert False, (base, path)


def endpoint(cid, port):
    published = command("docker", "port", cid, f"{port}/tcp").rsplit(":", 1)[1]
    return f"http://127.0.0.1:{published}"


def main():
    stack = yaml.safe_load((HERE / "compose.swarm.yml").read_text())
    dashboard = json.loads((HERE / "grafana/overview.json").read_text())
    panel = next(panel for panel in dashboard["panels"] if panel["id"] == 104)
    expression = panel["targets"][0]["expr"]
    assert panel["datasource"]["uid"] == "prometheus"
    containers = []
    network = ""
    test_user = f"{os.getuid()}:{os.getgid()}"
    with tempfile.TemporaryDirectory(dir=ROOT, prefix=".yearly-dashboard-") as tmp:
        directory = Path(tmp)
        now = int(time.time())
        samples = [
            ("/historisch", 7, now - 180 * 86400),
            ("/historisch", 11, now - 86400),
            ("/anders", 3, now - 86400),
            ("/ausserhalb", 100, now - 400 * 86400),
        ]
        lines = ["# TYPE projekt_nginx_requests_5m gauge"]
        for path, count, timestamp in samples:
            lines.append(
                f'projekt_nginx_requests_5m{{environment="production",path="{path}"}} {count} {timestamp}'
            )
        lines.append("# EOF")
        (directory / "history.txt").write_text("\n".join(lines) + "\n")
        (directory / "prometheus.yml").write_text("global:\n  scrape_interval: 30s\nscrape_configs: []\n")
        image = stack["services"]["prometheus"]["image"]
        command(
            "docker",
            "run",
            "--rm",
            "--user",
            test_user,
            "--entrypoint",
            "/bin/promtool",
            "-v",
            f"{directory}:/test",
            image,
            "tsdb",
            "create-blocks-from",
            "openmetrics",
            "/test/history.txt",
            "/test/data",
        )
        try:
            network = command("docker", "network", "create", directory.name.lstrip("."))
            prometheus = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--user",
                test_user,
                "--network",
                network,
                "--network-alias",
                "prometheus",
                "-p",
                "127.0.0.1::9090",
                "-v",
                f"{directory}:/test",
                image,
                "--config.file=/test/prometheus.yml",
                "--storage.tsdb.path=/test/data",
                "--storage.tsdb.retention.time=730d",
                "--web.enable-remote-write-receiver",
            )
            containers.append(prometheus)
            prom = endpoint(prometheus, 9090)
            ready(prom, "/-/ready")
            cases = [
                (now, "", {
                    "/historisch": 18,
                    "/anders": 3,
                }),
                (now, "/historisch", {"/historisch": 18}),
                (now - 90 * 86400, "", {
                    "/historisch": 7,
                    "/ausserhalb": 100,
                }),
            ]
            for end, prefix, expected in cases:
                expr = expression.replace("$__range", "365d").replace("${url:regex}", prefix)
                actual = {
                    row["metric"]["path"]: float(row["value"][1])
                    for row in query(prom, expr, end)
                }
                assert actual == expected, (actual, expected)
            print("Erfolgreich: Jahresauswertung mit sechs Monaten Daten, URL-Filter und historischem Endzeitpunkt.")

            rules = yaml.safe_load((HERE / "loki-rules.yml").read_text())
            rules["groups"][0]["interval"] = "1s"
            rule_dir = directory / "rules/fake"
            rule_dir.mkdir(parents=True)
            (rule_dir / "nginx.yml").write_text(yaml.safe_dump(rules))
            config = helper.local_config()
            config["ruler"] = yaml.safe_load((HERE / "loki.yml").read_text())["ruler"]
            config["ruler"]["storage"]["local"]["directory"] = "/test/rules"
            config["ruler"]["evaluation_interval"] = "1s"
            config["ruler"]["remote_write"]["client"]["queue_config"] = {"batch_send_deadline": "1s"}
            (directory / "loki.yml").write_text(yaml.safe_dump(config))
            loki = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--user",
                "0:0",
                "--network",
                network,
                "-p",
                "127.0.0.1::3100",
                "-v",
                f"{directory}:/test:ro",
                stack["services"]["loki"]["image"],
                "-config.file=/test/loki.yml",
            )
            containers.append(loki)
            base = endpoint(loki, 3100)
            try:
                ready(base, "/ready")
            except AssertionError:
                print(command("docker", "logs", loki, include_stderr=True))
                raise
            values = []
            for i in range(2):
                values.append([
                    str(time.time_ns() - (90 - i) * 10**9),
                    json.dumps({
                        "path": "/live",
                        "status": 200,
                        "request_time": 0.2,
                        "upstream_time": "0.1",
                    }),
                ])
            request(base, "/loki/api/v1/push", {
                "streams": [{
                    "stream": {
                        "environment": "production",
                        "service_name": "nginx",
                        "log_type": "access",
                    },
                    "values": values,
                }],
            })
            for _ in range(90):
                counts = query(prom, 'projekt_nginx_requests_5m{path="/live"}', time.time())
                latency = query(prom, 'projekt_nginx_duration_p95_seconds_5m{category="application"}', time.time())
                if counts and latency:
                    assert float(counts[0]["value"][1]) == 2, counts
                    assert float(latency[0]["value"][1]) == 0.2, latency
                    break
                time.sleep(1)
            else:
                assert False, command("docker", "logs", loki, include_stderr=True)
            print("Erfolgreich: Echte Loki-Regeln zählen Logs und übertragen Anzahl und p95 nach Prometheus.")
        finally:
            for cid in reversed(containers):
                command("docker", "rm", "-f", cid)
            if network:
                command("docker", "network", "rm", network)


if __name__ == "__main__":
    main()
