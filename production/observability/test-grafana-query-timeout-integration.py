"""Echtes Grafana und Nginx mit einer 65 Sekunden verzögerten Loki-Testantwort.

--baseline entfernt das Datenquellen-Zeitlimit und muss nach etwa 30 Sekunden scheitern.
Voraussetzung: lokales Image projekt-observability-nginx-check und PyYAML.
"""

import http.server
import json
from pathlib import Path
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE / "errors"))
from messages import ERRORS


class Fixture(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.do_GET()

    def do_GET(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path == "/api/observability/auth":
            self.send_response(200 if self.headers.get("Cookie") == "test=allowed" else 401)
            self.send_header("X-Webauth-User", "timeout-test")
            self.send_header("X-Webauth-Role", "Admin")
            self.end_headers()
            return
        if "/query_range?" not in self.path:
            self.send_error(404)
            return
        if "fail" in self.path:
            self.send_error(500)
            return
        time.sleep(65)
        data = json.dumps({
            "status": "success",
            "data": {
                "resultType": "streams",
                "result": [{
                    "stream": {"service_name": "fixture"},
                    "values": [[
                        str(time.time_ns()),
                        "Verzögerte Abfrage abgeschlossen",
                    ]],
                }],
            },
        }).encode()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            # Bei der Gegenprobe schließt Grafana die Verbindung nach seinem alten Zeitlimit.
            pass


def command(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(ERRORS["COMMAND"].format(
            program=args[0],
            action=args[1],
            status=result.returncode,
            output=result.stdout + result.stderr,
        ))
    return result.stdout.strip()


def main():
    import yaml

    stack = yaml.safe_load((HERE / "compose.swarm.yml").read_text())
    network = "grafana-timeout-" + uuid.uuid4().hex[:8]
    containers = []
    command("docker", "network", "create", network)
    try:
        with tempfile.TemporaryDirectory(prefix=".grafana-timeout-", dir=ROOT) as tmp:
            path = Path(tmp)
            ds = yaml.safe_load((HERE / "grafana/datasources.yml").read_text())
            loki = next(item for item in ds["datasources"] if item["uid"] == "loki")
            loki["url"] = "http://fixture:8000"
            if "--baseline" in sys.argv:
                loki["jsonData"].pop("timeout", None)
            (path / "datasources.yml").write_text(yaml.safe_dump({
                "apiVersion": 1,
                "datasources": [loki],
            }))
            command(
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                str(path / "privkey.pem"),
                "-out",
                str(path / "fullchain.pem"),
                "-days",
                "1",
                "-subj",
                "/CN=localhost",
                "-addext",
                "subjectAltName=DNS:localhost",
            )
            fixture = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--network",
                network,
                "--network-alias",
                "fixture",
                "-v",
                f"{HERE}:/test:ro",
                "python:3.13.9-alpine3.22",
                "python",
                "/test/test-grafana-query-timeout-integration.py",
                "--fixture",
            )
            containers.append(fixture)
            grafana = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--network",
                network,
                "--network-alias",
                "observability_grafana",
                "-p",
                "127.0.0.1::3000",
                "-e",
                "GF_SERVER_ROOT_URL=http://localhost/grafana/",
                "-e",
                "GF_SERVER_SERVE_FROM_SUB_PATH=true",
                "-e",
                "GF_AUTH_PROXY_ENABLED=true",
                "-e",
                "GF_AUTH_PROXY_HEADER_NAME=X-Webauth-User",
                "-e",
                "GF_USERS_AUTO_ASSIGN_ORG_ROLE=Editor",
                "-e",
                "GF_ANALYTICS_REPORTING_ENABLED=false",
                "-e",
                "GF_PLUGINS_PREINSTALL_DISABLED=true",
                "-v",
                f"{path}/datasources.yml:/etc/grafana/provisioning/datasources/test.yml:ro",
                stack["services"]["grafana"]["image"],
            )
            containers.append(grafana)
            port = command("docker", "port", grafana, "3000/tcp").rsplit(":", 1)[1]
            for _ in range(60):
                try:
                    with urllib.request.urlopen(f"http://localhost:{port}/grafana/api/health", timeout=2):
                        break
                except OSError:
                    time.sleep(1)
            else:
                raise AssertionError(ERRORS["GRAFANA_TEST_START"])
            config = (ROOT / "services/nginx/default.conf").read_text().replace(
                "tasks.nextjs:3000 resolve",
                "fixture:8000 resolve",
            ).replace(
                "server_name alex-schneider-dev.de;",
                "server_name localhost;",
            )
            (path / "default.conf").write_text(config)
            nginx = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--network",
                network,
                "-p",
                "127.0.0.1::443",
                "-v",
                f"{path}/default.conf:/etc/nginx/conf.d/default.conf:ro",
                "-v",
                f"{path}:/etc/letsencrypt/live/alex-schneider-dev.de:ro",
                "projekt-observability-nginx-check:latest",
            )
            containers.append(nginx)
            port = command("docker", "port", nginx, "443/tcp").rsplit(":", 1)[1]
            time.sleep(2)
            command("docker", "exec", nginx, "nginx", "-t")
            context = ssl.create_default_context(cafile=str(path / "fullchain.pem"))

            def query(expression):
                now = int(time.time() * 1000)
                data = {
                    "from": str(now - 86400000),
                    "to": str(now),
                    "queries": [{
                        "refId": "A",
                        "datasource": {
                            "type": "loki",
                            "uid": "loki",
                        },
                        "expr": expression,
                        "queryType": "range",
                        "maxLines": 200,
                        "intervalMs": 120000,
                        "maxDataPoints": 1000,
                    }],
                }
                req = urllib.request.Request(
                    f"https://localhost:{port}/grafana/api/ds/query",
                    data=json.dumps(data).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "Cookie": "test=allowed",
                    },
                )
                try:
                    with urllib.request.urlopen(req, context=context, timeout=125) as response:
                        return response.status, json.load(response)
                except urllib.error.HTTPError as exc:
                    raw = exc.read().decode()
                    try:
                        return exc.code, json.loads(raw)
                    except ValueError:
                        raise AssertionError((exc.code, raw))

            started = time.monotonic()
            status, body = query('{service_name="fixture"}')
            assert status == 200 and not body["results"]["A"].get("error"), (status, body)
            assert "Verzögerte Abfrage abgeschlossen" in json.dumps(body, ensure_ascii=False), body
            assert time.monotonic() - started >= 65
            print("Erfolgreich: 65 Sekunden verzögerte Loki-Antwort über echtes Grafana und Nginx.", flush=True)
            status, body = query('{service_name="fail"}')
            assert status >= 400 or body["results"]["A"].get("error"), (status, body)
            print("Erfolgreich: Echte Upstream-Fehler bleiben sichtbar.", flush=True)
    finally:
        for cid in reversed(containers):
            command("docker", "rm", "-f", cid)
        command("docker", "network", "rm", network)


if __name__ == "__main__":
    if "--fixture" in sys.argv:
        http.server.ThreadingHTTPServer(("0.0.0.0", 8000), Fixture).serve_forever()
    else:
        main()
