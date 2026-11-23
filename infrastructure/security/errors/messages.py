"""Zentrale Meldungen der Container-Sicherheitsprüfung."""

ERRORS = {
    "inventory": "Das Image-Inventar muss Dienste enthalten.",
    "service": "Ungültiger Dienstname: ",
    "digest": "Unveränderlicher sha256-Image-Verweis erforderlich: ",
    "export": "Der Export darf nur Paare aus Dienstname und Image enthalten.",
    "duplicate": "Doppelter Dienst: ",
    "missing": "Unvollständiger Export; fehlende Dienste: ",
    "arguments": "Dieser Befehl akzeptiert keine Argumente.",
    "stack": "Keine Dienste für Stack gefunden: ",
    "transition": ": Tasks starten noch oder werden beendet.",
    "rollout": ": Bereitstellung ist noch nicht abgeschlossen.",
    "pin": ": Dienst muss einen eindeutigen Image-Digest verwenden.",
    "empty": ": Keine laufenden Tasks; Image kann nicht bestätigt werden.",
    "mixed": ": Laufende Tasks verwenden verschiedene Images.",
    "changed": ": Dienst hat sich während des Exports geändert.",
    "failed": "Image-Export fehlgeschlagen: ",
}
