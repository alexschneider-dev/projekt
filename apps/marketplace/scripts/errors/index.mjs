export const ERRORS = {
  CONFIG: "Die lokale Konfiguration fehlt oder ist ungültig. Prüfe die Anleitung und .env.local.",
  DATABASE: "Der Generator benötigt den Benutzer marketplace_app im Schema marketplace.",
  ARGUMENT: "Die Argumente sind ungültig. Prüfe Menge, Startwert und Dateipfad.",
  IMPORT: "Der Bildimport wurde angehalten. Prüfe Konfiguration, Manifest und Anbieterstatus.",
  SOURCE: "Die Bildquelle oder ihre Antwort ist nicht zulässig.",
  SIZE: "Das Bild überschreitet die erlaubte Datei- oder Pixelgröße.",
  BUDGET: "Das konfigurierte R2-Speicherbudget würde überschritten. Der Upload wurde angehalten.",
  MANIFEST: "Das geprüfte Bildmanifest ist ungültig oder enthält widersprüchliche Zuordnungen.",
  PROCESS: "Die Bildverarbeitung konnte das Größenbudget nicht einhalten.",
  FAILED:
    "Der Vorgang ist fehlgeschlagen. Prüfe die lokale Einrichtung; geheime Fehlerdetails werden nicht ausgegeben.",
  LOCK: "Ein weiterer Daten- oder Bildimport ist bereits aktiv.",
};
