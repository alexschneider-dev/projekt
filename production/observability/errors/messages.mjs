export const ERRORS = {
  S3_CREDENTIALS: "Die private JSON-Datei muss vollständige einzeilige S3-Zugangsdaten enthalten.",
  S3_IN_USE: "Mindestens ein S3-Secret wird von einem Swarm-Service verwendet. Es wurde nichts geändert. Für laufende Installationen ist eine versionierte Rotation erforderlich.",
  S3_REPLACE: "Die S3-Secrets konnten nicht vollständig ersetzt werden. Docker-Zugriff und Service-Referenzen prüfen; anschließend denselben Austausch erneut ausführen. Keine anderen Secrets neu erstellen.",
  SETTINGS: "Die Monitoring-Einstellungen fehlen oder enthalten ungültige Platzhalter.",
  INPUT: "Eine private JSON-Datei und ein neues privates Ausgabeverzeichnis angeben.",
  CREDENTIALS: "S3-Schlüssel und SMTP-Passwort müssen vollständig und einzeilig sein.",
  SECRET: "Das Swarm Secret konnte nicht erstellt werden. Für einen erneuten Versuch eine neue Revision verwenden.",
  CONFIG: "Die Monitoring-Konfiguration konnte nicht gelesen werden.",
};
