import sys
from pathlib import Path
import json
import time
import urllib.parse
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


def get(
    path,
    params,
):
    url = "http://prometheus:9090/api/v1/" + path + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(
        url,
        timeout=20,
    ) as response:
        data = json.load(response)
    if data.get("status") != "success":
        raise RuntimeError(ERRORS["E2"])
    return data["data"]["result"]


def report(hours):
    if not 1 <= hours <= 72:
        raise ValueError(ERRORS["E3"])
    window = f"{hours}h"
    now = int(time.time())
    print(
        f'Historische Metriken: letzte {hours} Stunden; Ende UTC {time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now),)}'
    )
    queries = {
        "OOM-Abbrüche des Hosts": f"increase(node_vmstat_oom_kill[{window}])",
        "Redis-Verdrängungen": f"increase(redis_evicted_keys_total[{window}])",
        "Vom Collector abgewiesene Spans": f"increase(otelcol_receiver_refused_spans_total[{window}])",
        "Fehlgeschlagene Span-Exporte (Wiederholungen möglich)": f"increase(otelcol_exporter_send_failed_spans_total[{window}])",
        "Fehlgeschlagene Span-Einreihung": f"increase(otelcol_exporter_enqueue_failed_spans_total[{window}])",
        "Niedrigster verfügbarer RAM (MiB)": f"min_over_time(node_memory_MemAvailable_bytes[{window}]) / 1024 / 1024",
        "Swap-Einlagerungen pro Sekunde": "rate(node_vmstat_pswpin[5m])",
        "Swap-Auslagerungen pro Sekunde": "rate(node_vmstat_pswpout[5m])",
        "Alter der Grafana-Sicherung": "time() - grafana_backup_last_success_timestamp_seconds",
        "Größte Trace-Exportwarteschlange": f'max_over_time(otelcol_exporter_queue_size{{data_type="traces"}}[{window}])',
    }
    for label, query in queries.items():
        values = get(
            "query",
            {
                "query": query,
                "time": now,
            },
        )
        print(f"\n{label}:")
        if not values:
            print(
                "  KEINE DATEN (kein Nullwert; Metrik möglicherweise nicht verfügbar)"
            )
        for item in values:
            tags = {k: v for k, v in item["metric"].items() if k != "__name__"}
            print(f'  {json.dumps(tags, sort_keys=True,)} = {item["value"][1]}')
    values = get(
        "query_range",
        {
            "query": "up",
            "start": now - hours * 3600,
            "end": now,
            "step": "60s",
        },
    )
    print("\nZielverfügbarkeit im Abstand von 60 Sekunden:")
    for item in values:
        samples = item["values"]
        down = sum(float(v) == 0 for _, v in samples)
        print(
            f'  {item["metric"].get("job")} {item["metric"].get("instance")}: '
            f"{down}/{len(samples)} Messungen nicht erreichbar"
        )
    if not values:
        print("  KEINE DATEN")
    print(
        "\nGrenzen: Lücken und Ausfälle zwischen Messungen können fehlen. Alte Zählerreihen "
        "und Neustarts können die Auswertung beeinflussen. Neue Installationen haben keine "
        "Historie vor dem Erfassungsbeginn. Deployments können Ausfälle erklären."
    )


if __name__ == "__main__":
    report(int(sys.argv[1]) if len(sys.argv) > 1 else 6)
