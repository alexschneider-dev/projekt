export const JOB_ERRORS = {
  configuration: "Die Such-URL muss eine gültige HTTPS-Suchseite der unterstützten Jobbörse sein.",
  searchArgument: "Verwendung: npm run jobs:search:add -- SUCH_URL",
  database: "DATABASE_URL fehlt.",
  metadata: "Die Seitenangaben fehlen oder sind ungültig. Der Import wird abgebrochen.",
  links: "Die Ergebnisseite enthält keine erkennbaren Stellenlinks.",
  pagination: "Die gelieferte Seite entspricht nicht der angeforderten Seite oder wiederholt bereits gelesene Ergebnisse.",
  response: "Die Suchseite konnte nicht abgerufen werden.",
  blocked: "Der Zugriff wurde gesperrt. Der Durchlauf wird abgebrochen.",
  failed: "Der Stellenimport ist fehlgeschlagen.",
};
