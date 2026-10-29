import json
from pathlib import Path
import subprocess
import tempfile
import time
import uuid


ROOT = Path(__file__).resolve().parents[2]
IMAGE = "projekt-observability-nginx-check"
SERVER = """from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        cookie = self.headers.get('Cookie', '')
        if self.path == '/api/observability/auth':
            role = cookie.removeprefix('role=')
            self.send_response(204 if role in ['ADMIN', 'SUPER_ADMIN'] else 403 if role == 'USER' else 401)
            if role in ['ADMIN', 'SUPER_ADMIN']:
                self.send_header('X-Webauth-User', 'projekt-test')
                self.send_header('X-Webauth-Role', 'Admin' if role == 'SUPER_ADMIN' else 'Editor')
            self.end_headers()
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps(dict(self.headers)).encode())
    def log_message(self, *args): pass
HTTPServer(('0.0.0.0', 3000), Handler).serve_forever()
"""


def command(*args):
    return subprocess.check_output(
        args,
        text=True,
        stderr=subprocess.PIPE,
    ).strip()


def main():
    network = "projekt-nginx-test-" + uuid.uuid4().hex[:10]
    containers = []
    with tempfile.TemporaryDirectory(
        prefix=".nginx-test-",
        dir=ROOT,
    ) as tmp:
        root = Path(tmp)
        (root / "server.py").write_text(SERVER)
        command(
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "1",
            "-subj",
            "/CN=alex-schneider-dev.de",
            "-keyout",
            str(root / "privkey.pem"),
            "-out",
            str(root / "fullchain.pem"),
        )
        command(
            "docker",
            "network",
            "create",
            network,
        )
        try:
            backend = command(
                "docker",
                "run",
                "-d",
                "--rm",
                "--network",
                network,
                "--network-alias",
                "tasks.nextjs",
                "--network-alias",
                "observability_grafana",
                "-v",
                f"{root}/server.py:/server.py:ro",
                "python:3.13.9-alpine3.22",
                "python",
                "/server.py",
            )
            containers.append(backend)
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
                f"{root}:/etc/letsencrypt/live/alex-schneider-dev.de:ro",
                IMAGE,
            )
            containers.append(nginx)
            port = command(
                "docker",
                "port",
                nginx,
                "443/tcp",
            ).split(
                ":"
            )[-1]

            def request(*headers):
                args = [
                    "curl",
                    "--silent",
                    "--show-error",
                    "--insecure",
                    "--noproxy",
                    "*",
                    "--resolve",
                    f"alex-schneider-dev.de:{port}:127.0.0.1",
                    "-w",
                    "\n%{http_code}",
                    f"https://alex-schneider-dev.de:{port}/grafana/",
                ]
                for header in headers:
                    args.extend(
                        [
                            "-H",
                            header,
                        ]
                    )
                return command(*args).rsplit(
                    "\n",
                    1,
                )

            for _ in range(30):
                try:
                    body, status = request()
                    if status == "302":
                        break
                except subprocess.CalledProcessError:
                    pass
                time.sleep(1)
            assert (
                request(
                    "X-Webauth-User: admin",
                    "X-Webauth-Role: Admin",
                )[1]
                == "302"
            )
            body, status = request(
                "Cookie: role=USER",
                "X-Webauth-User: admin",
            )
            assert status == "403", (
                status,
                body,
            )
            for role, expected in [
                (
                    "ADMIN",
                    "Editor",
                ),
                (
                    "SUPER_ADMIN",
                    "Admin",
                ),
            ]:
                body, status = request(
                    f"Cookie: role={role}",
                    "X-Webauth-User: attacker",
                    "X-Webauth-Role: Admin",
                    "Authorization: Bearer secret",
                )
                assert status == "200", (
                    status,
                    body,
                )
                headers = json.loads(body)
                assert headers["X-Webauth-User"] == "projekt-test"
                assert headers["X-Webauth-Role"] == expected
                assert "Cookie" not in headers and "Authorization" not in headers
            output = command(
                "docker",
                "exec",
                nginx,
                "wget",
                "-qO-",
                "http://127.0.0.1:8080/stub_status",
            )
            assert "Active connections" in output
            print(
                "Erfolgreich: Nginx blockiert unberechtigte Zugriffe, ersetzt fremde Identitätsheader und liefert interne Metriken."
            )
        finally:
            for cid in reversed(containers):
                command(
                    "docker",
                    "rm",
                    "-f",
                    cid,
                )
            command(
                "docker",
                "network",
                "rm",
                network,
            )


if __name__ == "__main__":
    main()
