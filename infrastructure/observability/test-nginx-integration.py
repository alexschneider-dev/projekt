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
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.do_GET()
    def do_GET(self):
        cookie = self.headers.get('Cookie', '')
        if self.path == '/api/observability/auth':
            router_headers = [
                'RSC',
                'Next-Router-State-Tree',
                'Next-Router-Prefetch',
                'Next-Router-Segment-Prefetch',
                'Next-Url',
                'Next-Action',
            ]
            if any(self.headers.get(name) for name in router_headers):
                self.send_response(307)
                self.send_header('Location', '/api/observability/auth?_rsc=test')
                self.end_headers()
                return
            role = cookie.removeprefix('role=')
            self.send_response(204 if role == 'SUPER_ADMIN' else 403 if role in ['USER', 'ADMIN'] else 401)
            if role == 'SUPER_ADMIN':
                self.send_header('X-Webauth-User', 'projekt-test')
                self.send_header('X-Webauth-Role', 'Admin')
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
                "-p",
                "127.0.0.1::8443",
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

            def request(*headers, path="/grafana/", method="GET", body=None):
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
                    f"https://alex-schneider-dev.de:{port}{path}",
                ]
                if method == "HEAD":
                    args.append("--head")
                else:
                    args.extend([
                        "--request",
                        method,
                    ])
                if body is not None:
                    args.extend([
                        "--data-raw",
                        body,
                    ])
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
            # Seiten nehmen keine Server Actions an, auch nicht als Formular im Body.
            for path in [
                "/",
                "/login",
                "/dashboard",
            ]:
                for method in [
                    "GET",
                    "HEAD",
                ]:
                    assert request(path=path, method=method)[1] == "200"
                for headers, body in [
                    (
                        ["Next-Action: x"],
                        "[]",
                    ),
                    (
                        ["Content-Type: multipart/form-data; boundary=test"],
                        '--test\r\nContent-Disposition: form-data; name="$ACTION_ID_x"\r\n\r\n\r\n--test--\r\n',
                    ),
                ]:
                    assert request(*headers, path=path, method="POST", body=body)[1] == "405"
            # NextAuth- und Grafana-POSTs bleiben erreichbar (Backend im Test simuliert).
            assert request(path="/api/auth/callback/credentials", method="POST", body="test=1")[1] == "200"
            assert request(
                "Cookie: role=SUPER_ADMIN",
                path="/grafana/api/ds/query",
                method="POST",
                body="{}",
            )[1] == "200"
            # Router-Header dürfen weder die Auth-Prüfung umleiten noch Rollenprüfungen umgehen.
            for role, expected in [
                (
                    "",
                    "302",
                ),
                (
                    "USER",
                    "403",
                ),
                (
                    "ADMIN",
                    "403",
                ),
                (
                    "SUPER_ADMIN",
                    "200",
                ),
            ]:
                body, status = request(
                    f"Cookie: role={role}",
                    "RSC: 1",
                    "Next-Router-State-Tree: %5B%22%22%5D",
                    "Next-Router-Prefetch: 1",
                    "Next-Router-Segment-Prefetch: /_tree",
                    "Next-Url: /super-admin",
                    "Next-Action: test",
                )
                assert status == expected, (
                    status,
                    body,
                )
            edge_port = command(
                "docker",
                "port",
                nginx,
                "8443/tcp",
            ).rsplit(
                ":",
                1,
            )[-1]
            # Den Produktionsweg mit PROXY-Protokoll und internem TLS-Port prüfen.
            for path, target in [
                (
                    "/grafana/",
                    "/login",
                ),
                (
                    "/grafana/d/projekt-production",
                    "/login",
                ),
                (
                    "/grafana",
                    "/grafana/",
                ),
            ]:
                response = command(
                    "curl",
                    "--silent",
                    "--show-error",
                    "--insecure",
                    "--noproxy",
                    "*",
                    "--haproxy-protocol",
                    "--resolve",
                    f"alex-schneider-dev.de:{edge_port}:127.0.0.1",
                    "-H",
                    "Host: alex-schneider-dev.de",
                    "--dump-header",
                    "-",
                    "--output",
                    "/dev/null",
                    f"https://alex-schneider-dev.de:{edge_port}{path}",
                )
                assert " 302 " in response, response
                location = next(
                    line.split(
                        ":",
                        1,
                    )[1].strip()
                    for line in response.splitlines()
                    if line.lower().startswith("location:")
                )
                assert location == f"https://alex-schneider-dev.de{target}", location
            for role in [
                "USER",
                "ADMIN",
            ]:
                body, status = request(
                    f"Cookie: role={role}",
                    "X-Webauth-User: admin",
                    "X-Webauth-Role: Admin",
                )
                assert status == "403", (
                    status,
                    body,
                )
            for role, expected in [
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
            # Ein ungültiger HTTP/1.1-Aufruf hinter dem Edge-Proxy erzeugt einen echten 400er.
            for profil in [
                "diagnose",
                "standard",
            ]:
                command(
                    "docker",
                    "exec",
                    nginx,
                    "ln",
                    "-sf",
                    f"/etc/nginx/security-{profil}.inc",
                    "/etc/nginx/security-aktiv.inc",
                )
                command("docker", "exec", nginx, "nginx", "-t")
                command("docker", "exec", nginx, "nginx", "-s", "reload")

                for versuch in range(30):
                    pfad = f"/test-{profil}-{versuch}"
                    status = command(
                        "curl",
                        "--silent",
                        "--insecure",
                        "--http1.1",
                        "--haproxy-protocol",
                        "--noproxy",
                        "*",
                        "--resolve",
                        f"alex-schneider-dev.de:{edge_port}:127.0.0.1",
                        "-H",
                        "Host:",
                        "-o",
                        "/dev/null",
                        "-w",
                        "%{http_code}",
                        f"https://alex-schneider-dev.de:{edge_port}{pfad}",
                    )
                    assert status == "400", status
                    logs = subprocess.run(
                        [
                            "docker",
                            "logs",
                            nginx,
                        ],
                        capture_output=True,
                        text=True,
                        check=True,
                    )
                    eintraege = [
                        json.loads(zeile)
                        for zeile in logs.stderr.splitlines()
                        if zeile.startswith("{") and pfad in zeile
                    ]
                    if eintraege and ("connection" in eintraege[0]) == (profil == "diagnose"):
                        break
                    time.sleep(0.1)
                assert len(eintraege) == 1, eintraege
                eintrag = eintraege[0]
                assert ("connection" in eintrag) == (profil == "diagnose")
                if profil == "diagnose":
                    assert eintrag["server_port"] == "8443"
                    assert eintrag["proxy_client_ip"] == "127.0.0.1"
                    assert eintrag["peer_ip"]
                    assert f'*{eintrag["connection"]} ' in logs.stderr
                betriebslogs = [
                    json.loads(zeile)
                    for zeile in logs.stdout.splitlines()
                    if zeile.startswith("{") and pfad in zeile
                ]
                assert len(betriebslogs) == 1, betriebslogs
                assert "proxy_client_ip" not in betriebslogs[0]

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
