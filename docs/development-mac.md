# Entwicklung auf dem Mac: vom Klon bis zur Anmeldung

Diese Anleitung verwendet die vorhandene Docker-Compose-Umgebung mit Next.js,
PostgreSQL 17, Redis und Nginx. Die Anwendung läuft unter `https://localhost`.
Monitoring, S3 und SMTP sind für die lokale Entwicklung nicht erforderlich.
Alle Befehle im Terminal ausführen; ab Schritt 2 im Repository-Hauptverzeichnis.
Vorhandene lokale Konfigurationen nicht überschreiben.

## 1. Werkzeuge installieren

Voraussetzung ist [Homebrew](https://brew.sh/). Anschließend:

```sh
xcode-select --install
brew install git node@22 colima docker docker-compose mkcert
mkdir -p ~/.docker/cli-plugins
ln -sfn "$(brew --prefix)/opt/docker-compose/bin/docker-compose" ~/.docker/cli-plugins/docker-compose
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version
npm --version
colima start --cpu 5 --memory 6
docker compose version
docker info
```

Wenn die Command Line Tools bereits installiert sind, ist keine erneute Installation
nötig. Den Node-PATH auch in `~/.zshrc` hinterlegen. Das Projekt verlangt Node.js
22 ab 22.22.2, kleiner als 23. Für Compose wird eine aktuelle Version mit
`develop.watch` und `initial_sync` benötigt. Die Colima-Zuweisung muss neben macOS
und den übrigen Programmen in den vorhandenen Arbeitsspeicher passen.

Grundlagen: [Colima-Installation](https://colima.run/docs/installation/) und
[lokale Zertifikate mit mkcert](https://github.com/FiloSottile/mkcert).
Docker Desktop ist eine Alternative; dann Colima nicht starten und die folgenden
Compose-Befehle mit dem Docker-Desktop-Kontext verwenden.

## 2. Repository klonen

`REPOSITORY_URL` durch die tatsächliche SSH- oder HTTPS-Adresse ersetzen:

```sh
git clone REPOSITORY_URL projekt
cd projekt
npm ci
npx prisma generate
```

Bei einem privaten Repository wird ein berechtigter SSH-Schlüssel oder ein
GitHub-Zugang zum Lesen des Repositorys benötigt. Für die lokalen Images ist kein
GHCR-Token erforderlich, sie werden aus dem Quellcode gebaut.

## 3. Lokale Konfiguration anlegen

Die folgenden Dateien sind absichtlich nicht versioniert und fehlen nach dem Klonen.
Nur bei einer frischen Einrichtung ausführen:

```sh
umask 077
cat > services/development/scripts/.env.development.docker <<'EOF'
PROJEKT_DEV_VERSION=lokal
NGINX_DEV_VERSION=lokal
POSTGRES_PASSWORD=lokales-entwicklungspasswort
EOF

cat > .env.local <<'EOF'
DATABASE_URL=postgresql://postgres:lokales-entwicklungspasswort@localhost:5432/postgres
NEXTAUTH_URL=https://localhost
OBSERVABILITY_ENABLED=false
EOF
printf 'NEXTAUTH_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
```

Das gezeigte Datenbankpasswort gilt ausschließlich lokal. Bei Änderungen muss es
in beiden Dateien übereinstimmen. Im Next.js-Container setzt Compose automatisch
`DATABASE_URL` mit dem Host `postgres` und `REDIS_URL` mit dem Host `redis`.
Die URL in `.env.local` dient Werkzeugen, die auf dem Mac laufen.
Ein geändertes `POSTGRES_PASSWORD` setzt das Passwort in einem vorhandenen
Datenbankvolume nicht zurück.

## 4. HTTPS-Zertifikate erstellen

```sh
mkcert -install
mkcert -cert-file services/development/nginx-dev/fullchain.pem \
  -key-file services/development/nginx-dev/privkey.pem \
  localhost 127.0.0.1 ::1
```

macOS fragt gegebenenfalls nach dem Passwort für den lokalen Zertifikatsspeicher.
Die PEM-Dateien werden beim Nginx-Build benötigt. Sie und die lokale CA bleiben
auf dem Mac; insbesondere den privaten CA-Schlüssel nicht weitergeben.

## 5. Dienste starten und Datenbank vorbereiten

Diese Funktion gilt für das aktuelle Terminal; in neuen Terminals erneut definieren:

```sh
dc() {
  docker compose --env-file services/development/scripts/.env.development.docker \
    -f services/development/scripts/compose.dev.yml --profile dev "$@"
}

dc up -d --build
dc ps
dc exec nextjs-projekt npx prisma migrate deploy
dc exec nextjs-projekt npm run auth:create-user -- admin@example.test SUPER_ADMIN Administration
```

Auf einen gesunden PostgreSQL-Container warten, bevor die Migration ausgeführt wird.
Das Kontenskript fragt das Passwort verdeckt zweimal ab (12–128 Zeichen).
Danach `https://localhost` öffnen, zur Anmeldung gehen und das neue Konto verwenden.
Es gibt keine öffentliche Registrierung. Die Anmeldung führt auf die Homepage.

## 6. Änderungen synchronisieren

In einem eigenen Terminal im Repository die Funktion `dc` erneut definieren und starten:

```sh
dc up --watch --menu=false --no-deps nextjs-projekt
```

Dieses Terminal geöffnet lassen. Compose Watch überträgt Quellcodeänderungen und
baut bei Änderungen an Paketdateien oder Prisma neu. Änderungen an `.env.local`
erfordern einen Neustart (`dc restart nextjs-projekt`); Änderungen an der Compose-
Env-Datei ein erneutes `dc up -d`. Bei neuen Migrationen nochmals
`dc exec nextjs-projekt npx prisma migrate deploy` ausführen.
Änderungen an lokalen Nginx-Dateien oder Zertifikaten mit `dc up -d --build nginx` übernehmen.

Optional startet `bash services/development/scripts/start_local_services.sh`
Colima, Dienste und Monitorfenster automatisch. Dieses Komfortskript erwartet
zusätzlich Terminal, Visual Studio Code und Google Chrome und kann macOS-
Automatisierungsberechtigungen anfordern. Die obigen Befehle benötigen diese Apps nicht.

## 7. Prüfen und beenden

```sh
npm run check
npm test
npx playwright install chromium firefox webkit
npm run test:all
```

Die Tests verwenden eine eigene Datenbank auf Port 55432; weitere Details stehen
in [der Testanleitung](../testing/README.md). Prisma CLI lädt `.env.local` auf dem
Mac nicht automatisch. Migrationen deshalb wie oben im Container ausführen.

```sh
dc logs --tail=100 nextjs-projekt postgres nginx
dc down
colima stop
```

Zuvor Compose Watch mit Strg+C beenden. `down` erhält die Datenvolumes.
`down -v` würde lokale Daten löschen und gehört nicht zum normalen Beenden.

## Häufige Startprobleme

| Symptom | Prüfung |
| --- | --- |
| Env-Datei oder PEM-Datei fehlt | Schritte 3 und 4; diese Dateien werden nicht geklont. |
| Port belegt | Andere Dienste auf 80, 443, 3000 oder 5432 beenden oder bewusst umkonfigurieren. |
| Docker nicht erreichbar | `colima status`, `docker context ls`; passenden Kontext auswählen. |
| Datenbankanmeldung schlägt fehl | Passwort, Datenbank `postgres` und bestehendes Volume prüfen. |
| Tabellen fehlen | Migration aus Schritt 5 ausführen. |
| Codeänderung erscheint nicht | Watch-Prozess prüfen; `services/` wird nicht als Quellcode synchronisiert. |
| Zertifikat nicht vertraut | `mkcert -install`, Zertifikatsnamen und Browserneustart prüfen. |

Die Entwicklungsdatenbank wird derzeit auf Host-Port 5432 veröffentlicht.
Diese Compose-Datei ist ausschließlich für den Entwicklungsrechner bestimmt.
