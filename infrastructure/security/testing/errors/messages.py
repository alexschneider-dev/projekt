"""Zentrale Fehlermeldungen der Image-Funktionsprüfungen."""

ERRORS = {
    "metrics_missing": ": Metrik-Endpunkt liefert keine Build-Informationen.",
    "prometheus_not_ready": "Prometheus wurde nicht bereit.",
    "tempo_exited": "Tempo-Testcontainer wurde vor der Bereitschaft beendet.",
    "tempo_not_ready": "Tempo-Testcontainer wurde nicht bereit.",
    "trace_missing": "Die synthetische Trace konnte nicht gelesen werden.",
    "thanos_not_ready": "Thanos wurde nicht bereit.",
}
