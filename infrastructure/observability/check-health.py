import sys
from pathlib import Path
import json
import urllib.request


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


def check(fetch):
    for service, url in {
        "grafana": "http://grafana:3000/grafana/api/health",
        "prometheus": "http://prometheus:9090/-/ready",
        "loki": "http://loki:3100/ready",
        "tempo": "http://tempo:3200/ready",
        "alloy": "http://alloy:12345/-/ready",
        **{
            name: f"http://{name}:10902/-/ready"
            for name in [
                "thanos-query",
                "thanos-sidecar",
                "thanos-store",
                "thanos-compact",
            ]
        },
    }.items():
        fetch(url)
        print(f"OK: {service} ist bereit")
    data = json.loads(fetch("http://prometheus:9090/api/v1/targets"))
    if data.get("status") != "success":
        raise RuntimeError(ERRORS["E9"])
    targets = data["data"]["activeTargets"]
    required = {
        "grafana",
        "prometheus",
        "loki",
        "tempo",
        "alloy",
        "node",
        "cadvisor",
        "swarm-exporter",
        "nginx-exporter",
        "postgres-exporter",
        "redis-exporter",
        "nextjs",
        "thanos-query",
        "thanos-sidecar",
        "thanos-store",
        "thanos-compact",
    }
    missing = required - {t["labels"].get("job") for t in targets}
    down = [
        t["labels"].get(
            "job",
            "?",
        )
        for t in targets
        if t["health"] != "up"
    ]
    if missing or down:
        raise RuntimeError(
            ERRORS["TARGETS"].format(
                missing=sorted(missing),
                down=down,
            )
        )
    query = '{__name__=~"pg_up|redis_up|nginx_up"}'
    from urllib.parse import urlencode

    values = json.loads(
        fetch("http://prometheus:9090/api/v1/query?" + urlencode({"query": query}))
    )
    if values.get("status") != "success":
        raise RuntimeError(ERRORS["E10"])
    result = values["data"]["result"]
    if {v["metric"]["__name__"] for v in result} != {
        "pg_up",
        "redis_up",
        "nginx_up",
    }:
        raise RuntimeError(ERRORS["E11"])
    if any(float(v["value"][1]) != 1 for v in result):
        raise RuntimeError(ERRORS["E12"])
    values = json.loads(
        fetch(
            "http://thanos-query:10902/api/v1/query?"
            + urlencode(
                {
                    "query": "up",
                    "partial_response": "false",
                }
            )
        )
    )
    if (
        values.get("status") != "success"
        or not values.get(
            "data",
            {},
        ).get("result")
        or values.get("warnings")
    ):
        raise RuntimeError(ERRORS["E13"])
    print(f"OK: {len(targets)} Metrik-Ziele, Exporter-Verbindungen und Thanos-Abfrage")


def fetch(url):
    with urllib.request.urlopen(
        url,
        timeout=5,
    ) as response:
        return response.read()


if __name__ == "__main__":
    check(fetch)
