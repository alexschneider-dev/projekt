# Interner Login

NextAuth v4 Credentials mit JWT-Sitzungen (8 Stunden), Prisma und PostgreSQL.
Keine öffentliche Registrierung. Kundenrollen sind nicht Teil der internen Rollen.

## Einrichtung

In `.env.local` für Next.js bzw. als Umgebungsvariablen im Deployment setzen:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=EIN_ZUFAELLIGES_SECRET
```

Für Produktion die tatsächliche HTTPS-Adresse und ein zufälliges Secret verwenden
(z. B. lokal mit `openssl rand -base64 32` erzeugen). Keine Secrets committen.
Die Produktionskonfiguration für Next.js muss diese Variablen ebenfalls erhalten.
Beim Deployment auch das geänderte Nginx-Image ausrollen: Seiten-Cookies werden jetzt
weitergeleitet und dynamische Seiten nicht mehr öffentlich zwischengespeichert.

Prisma CLI lädt `.env`, nicht automatisch `.env.local`: `DATABASE_URL` im Terminal
bereitstellen oder eine lokale, ignorierte `.env` verwenden.

```sh
npx prisma migrate deploy
npx prisma generate
npm run auth:create-user -- admin@example.com SUPER_ADMIN "Administration"
```

Das Skript lädt `.env.local` und fragt das Passwort verdeckt mit Bestätigung ab.
Weitere Konten genauso mit `ADMIN` oder `USER` anlegen; Standard ist `USER`.
Bestehende Konten werden nicht überschrieben.
Die Migration zur Großschreibung benennt die vorhandenen Enum-Werte in der
Datenbank um; Rollen und Konten bleiben dabei erhalten. Sie muss vor dem Start
der Anwendung mit den neuen Rollenwerten ausgeführt werden.

## Zugriff

- `/`: öffentliche Homepage mit Links zur Anmeldung und zum internen Bereich.
- `/login`: Anmeldung; nach erfolgreichem Login geht es zur Homepage. Abmeldung führt zur Login-Seite zurück.
- Fehlende Rollenberechtigung führt zur Homepage.
- `/dashboard`: alle aktiven internen Benutzer.
- `/admin`: Admin und Super-Admin.
- `/super-admin`: ausschließlich Super-Admin.

`requireRole()` mit dem Ergebnis `apiGate` an jeder geschützten Seite und insbesondere direkt vor Datenzugriffen
und Server Actions aufrufen. Ein Layout oder ausgeblendete Navigation genügt nicht.
Für künftige JSON-APIs 401/403 statt Seiten-Redirects zurückgeben.
Die Session liest den aktuellen Benutzer aus der Datenbank. `active=false` sperrt
Zugriffe sofort; Rollenänderungen gelten beim nächsten Zugriff. Bei Passwortänderung
oder gewünschter Abmeldung aller Geräte `sessionVersion` atomar erhöhen.
Passwort-Hashes nie an den Browser zurückgeben.

Passwörter: gesalzenes scrypt (N=32768, r=8, p=3), 12–128 Zeichen beim Anlegen.
Anmeldung: maximal 10 Versuche je normalisierter E-Mail in 15 Minuten, gemeinsam
über PostgreSQL für alle Replikate; gilt auch für erfolgreiche Versuche.
Zusätzlich sollte der Reverse Proxy IP-basierte Limits gegen verteilte Versuche über
viele Konten setzen. Abgelaufene `LoginAttempt`-Einträge regelmäßig löschen:

```sql
DELETE FROM "LoginAttempt" WHERE "expiresAt" < NOW();
```

Die Verwaltungsseiten sind zunächst geschützte Platzhalter. Eine Oberfläche für
Kontenverwaltung, Passwort-Zurücksetzen per E-Mail und Kundenmitgliedschaften ist
noch nicht enthalten. Passwörter können vorerst kontrolliert über ein administratives
Skript mit `hashPassword()` geändert werden, dabei `sessionVersion` erhöhen.

## Prüfungen

```sh
npm run check
npm run test:auth
```

Mit einer eingerichteten Testdatenbank zusätzlich Anmeldung/Abmeldung für jede Rolle,
falsches Passwort, elften Anmeldeversuch, direkte Admin-URLs, deaktivierte Konten und
Rollenänderung während einer Sitzung prüfen.
