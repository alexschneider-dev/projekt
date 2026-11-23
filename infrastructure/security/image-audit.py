"""Exakten Swarm-Export prüfen und eine nach Image-Digest gruppierte Scan-Matrix erzeugen."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re

from errors.messages import ERRORS


ROOT = Path(__file__).resolve().parent
SERVICE = re.compile(r"(?:projekt|projekt-edge|observability)_[a-zA-Z0-9_-]+")
IMAGE = re.compile(r"[a-z0-9][a-zA-Z0-9._/:\-]*@sha256:[a-f0-9]{64}")


def validate(services):
    if not isinstance(services, dict) or not services:
        raise ValueError(ERRORS["inventory"])
    for service, image in services.items():
        if not isinstance(service, str) or not SERVICE.fullmatch(service):
            raise ValueError(ERRORS["service"] + str(service))
        if not isinstance(image, str) or not IMAGE.fullmatch(image):
            raise ValueError(ERRORS["digest"] + service)
    return services


def parse_export(text):
    services = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 2:
            raise ValueError(ERRORS["export"])
        service, image = fields
        if service in services:
            raise ValueError(ERRORS["duplicate"] + service)
        services[service] = image
    return validate(services)


def matrix(services):
    grouped = {}
    for service, image in sorted(validate(services).items()):
        grouped.setdefault(image, []).append(service)
    return {
        "include": [
            {
                "image": image,
                "services": ", ".join(names),
            }
            for image, names in grouped.items()
        ]
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-export", type=Path)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--required-services", type=Path, default=ROOT / "required-services.json")
    args = parser.parse_args()
    required = set(json.loads(args.required_services.read_text()))
    if args.import_export:
        services = parse_export(args.import_export.read_text())
    else:
        services = validate(json.loads(args.inventory.read_text())["services"])
    missing = required - services.keys()
    if missing:
        raise ValueError(ERRORS["missing"] + ", ".join(sorted(missing)))
    if args.import_export:
        inventory = {
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "services": dict(sorted(services.items())),
        }
        args.inventory.write_text(json.dumps(inventory, indent=2) + "\n")
    print(
        json.dumps(
            matrix(services),
            separators=(
                ",",
                ":",
            ),
        )
    )


if __name__ == "__main__":
    main()
