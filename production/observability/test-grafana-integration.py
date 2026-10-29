"""Lädt die tatsächlichen Dashboards, Datenquellen und Alarmregeln in Grafana."""

import base64
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import yaml


HERE = Path(__file__).resolve().parent


def command(*args):
    return subprocess.check_output(
        args,
        text=True,
        stderr=subprocess.PIPE,
    ).strip()


def main():
    stack = yaml.safe_load((HERE / "compose.swarm.yml").read_text())
    service = stack["services"]["grafana"]
    args = [
        "docker",
        "run",
        "-d",
        "--rm",
        "-p",
        "127.0.0.1::3000",
    ]
    for entry in service["configs"]:
        source = HERE / stack["configs"][entry["source"]]["file"]
        args.extend(
            [
                "-v",
                f'{source}:{entry["target"]}:ro',
            ]
        )
    for key, value in {
        "GF_SERVER_ROOT_URL": "http://localhost/grafana/",
        "GF_SERVER_SERVE_FROM_SUB_PATH": "true",
        "GF_SECURITY_ADMIN_PASSWORD": "local-test-password",
        "GF_ANALYTICS_REPORTING_ENABLED": "false",
        "ALERT_EMAIL_TO": "monitoring@test.invalid",
    }.items():
        args.extend(
            [
                "-e",
                f"{key}={value}",
            ]
        )
    args.append(service["image"])
    cid = command(*args)
    try:
        port = command(
            "docker",
            "port",
            cid,
            "3000/tcp",
        ).split(
            ":"
        )[-1]

        def get(path):
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/grafana" + path,
                headers={
                    "Authorization": "Basic "
                    + base64.b64encode(b"admin:local-test-password").decode()
                },
            )
            with urllib.request.urlopen(
                request,
                timeout=5,
            ) as response:
                return json.load(response)

        for _ in range(60):
            try:
                if get("/api/health")["database"] == "ok":
                    break
            except (
                OSError,
                urllib.error.URLError,
            ):
                pass
            time.sleep(1)
        dashboards = get("/api/search")
        assert any(
            item["title"] == "Projekt – Betrieb und Diagnose" for item in dashboards
        )
        rules = get("/api/v1/provisioning/alert-rules")
        expected = yaml.safe_load((HERE / "grafana/alerting.yml").read_text())
        assert len(rules) == sum(len(group["rules"]) for group in expected["groups"])
        assert {d["uid"] for d in get("/api/datasources")} == {
            "prometheus",
            "prometheus-live",
            "loki",
            "tempo",
        }
        print(
            "Erfolgreich: Dashboard, vier Datenquellen und alle Alarmregeln provisioniert."
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
