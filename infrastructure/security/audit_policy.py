"""Gemeinsame Scan-Regeln für laufende Dienste und geplante Observability-Images."""

REPORT_ONLY_SERVICES = {
    "projekt_postgres",
    "observability_grafana",
    "observability_alloy",
}


def image_matrix(services):
    grouped = {}
    for service, image in sorted(services.items()):
        grouped.setdefault(image, []).append(service)
    return {
        "include": [
            {
                "image": image,
                "services": ", ".join(names),
                # Gemeinsam genutzte Images bleiben bei mindestens einem strengen Dienst blockierend.
                "report_only": all(name in REPORT_ONLY_SERVICES for name in names),
            }
            for image, names in grouped.items()
        ]
    }
