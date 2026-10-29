"""Echter Nginx mit verzögertem HTTP-Testserver, ohne Produktionszugriff.
Prüft Browser-Abbrüche, Anmeldung, HTTP-Fehler und Live-WebSockets.
Vorher: docker build -t projekt-observability-nginx-check services/nginx
Mit --baseline das vorherige Abbruchverhalten reproduzieren.
"""

import http.server
import pathlib
import platform
import select
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import uuid

sys.path.insert(
    0,
    str(pathlib.Path(__file__).resolve().parent / "errors"),
)
from messages import ERRORS


ROOT = pathlib.Path(__file__).resolve().parents[2]
started = threading.Event()
finished = threading.Event()
results = []


def cmd(*args):
    p = subprocess.run(
        args,
        capture_output=True,
        text=True,
    )
    if p.returncode:
        raise RuntimeError(
            ERRORS["COMMAND"].format(
                program=args[0],
                action=args[1],
                status=p.returncode,
                output=p.stdout + p.stderr,
            )
        )
    return (
        p.stdout
        + (
            p.stderr
            if args[:2]
            == (
                "docker",
                "logs",
            )
            else ""
        )
    ).strip()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.do_GET()

    def do_GET(self):
        self.rfile.read(
            int(
                self.headers.get(
                    "Content-Length",
                    0,
                )
            )
        )
        if self.path == "/api/observability/auth":
            self.send_response(
                200 if self.headers.get("Cookie") == "test=allowed" else 401
            )
            self.send_header(
                "X-Webauth-User",
                "fixture-editor",
            )
            self.end_headers()
            return
        if self.path == "/grafana/api/live/ws":
            self.send_response(101)
            self.send_header(
                "Connection",
                "Upgrade",
            )
            self.send_header(
                "Upgrade",
                "websocket",
            )
            self.end_headers()
            self.wfile.flush()
            started.set()
            self.connection.settimeout(5)
            results.append(
                (
                    "ws",
                    self.connection.recv(1) == b"",
                )
            )
            finished.set()
            return
        if self.path.endswith("/failure"):
            self.send_response(500)
            self.end_headers()
            return
        if self.path == "/grafana/api/ds/query?large-response=1":
            started.set()
            time.sleep(1)
            failed = False
            try:
                self.send_response(200)
                self.send_header(
                    "Content-Length",
                    str(8 * 1024 * 1024),
                )
                self.end_headers()
                for _ in range(128):
                    self.wfile.write(b"x" * 65536)
                    self.wfile.flush()
                    time.sleep(0.01)
            except (
                BrokenPipeError,
                ConnectionResetError,
            ):
                failed = True
            results.append(
                (
                    "large-response",
                    failed,
                )
            )
            finished.set()
            return
        started.set()
        time.sleep(1)
        ready, _, _ = select.select(
            [self.connection],
            [],
            [],
            0,
        )
        closed = (
            bool(ready)
            and self.connection.recv(
                1,
                socket.MSG_PEEK,
            )
            == b""
        )
        results.append(
            (
                self.path,
                closed,
                self.headers.get("X-Webauth-User"),
            )
        )
        try:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")
        except (
            BrokenPipeError,
            ConnectionResetError,
        ):
            pass
        finished.set()


server = http.server.ThreadingHTTPServer(
    (
        "0.0.0.0",
        0,
    ),
    Handler,
)
threading.Thread(
    target=server.serve_forever,
    daemon=True,
).start()
cid = None
network = "grafana-cancel-" + uuid.uuid4().hex[:8]
cmd(
    "docker",
    "network",
    "create",
    network,
)
try:
    with tempfile.TemporaryDirectory(
        prefix=".grafana-cancel-",
        dir=ROOT,
    ) as tmp:
        p = pathlib.Path(tmp)
        cmd(
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            str(p / "privkey.pem"),
            "-out",
            str(p / "fullchain.pem"),
            "-days",
            "1",
            "-subj",
            "/CN=alex-schneider-dev.de",
        )
        backend = f"host.docker.internal:{server.server_port}"
        config = (
            (ROOT / "services/nginx/default.conf")
            .read_text()
            .replace(
                "tasks.nextjs:3000 resolve",
                backend + " resolve",
            )
            .replace(
                "observability_grafana:3000",
                backend,
            )
        )
        if "--baseline" in sys.argv:
            config = config.replace(
                "proxy_ignore_client_abort on;",
                "proxy_ignore_client_abort off;",
            )
        (p / "default.conf").write_text(config)
        cid = cmd(
            "docker",
            "run",
            "-d",
            "--rm",
            "--network",
            network,
            *(
                [
                    "--add-host",
                    "host.docker.internal:host-gateway",
                ]
                if platform.system() == "Linux"
                else []
            ),
            "-p",
            "127.0.0.1::443",
            "-v",
            f"{p}/default.conf:/etc/nginx/conf.d/default.conf:ro",
            "-v",
            f"{p}:/etc/letsencrypt/live/alex-schneider-dev.de:ro",
            "projekt-observability-nginx-check:latest",
        )
        port = int(
            cmd(
                "docker",
                "port",
                cid,
                "443/tcp",
            ).rsplit(
                ":",
                1,
            )[1]
        )
        time.sleep(2)
        cmd(
            "docker",
            "exec",
            cid,
            "nginx",
            "-t",
        )
        context = ssl.create_default_context(cafile=str(p / "fullchain.pem"))
        time.sleep(2)

        def connect():
            return context.wrap_socket(
                socket.create_connection(
                    (
                        "127.0.0.1",
                        port,
                    ),
                    timeout=5,
                ),
                server_hostname="alex-schneider-dev.de",
            )

        # Ohne Anmeldung dürfen Dashboard- und Datenabfragen das Backend nicht erreichen.
        for path in [
            "/grafana/d/test/test",
            "/grafana/api/ds/query",
        ]:
            with connect() as s:
                s.sendall(
                    f"GET {path} HTTP/1.1\r\nHost: alex-schneider-dev.de\r\nConnection: close\r\n\r\n".encode()
                )
                response = s.recv(4096)
                assert b" 302 " in response, (
                    path,
                    response,
                    cmd(
                        "docker",
                        "logs",
                        cid,
                    ),
                )
        assert not results
        print(
            "OK: Anmeldung für Dashboard und Datenabfragen bleibt erforderlich.",
            flush=True,
        )
        for path in [
            "/grafana/d/test/test",
            "/grafana/api/ds/query",
            "/grafana/api/other",
        ]:
            started.clear()
            finished.clear()
            s = connect()
            method = "POST" if path.endswith("/query") else "GET"
            s.sendall(
                f"{method} {path} HTTP/1.1\r\nHost: alex-schneider-dev.de\r\nCookie: test=allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".encode()
            )
            assert started.wait(5), (
                ERRORS["UPSTREAM_MISSING"],
                cmd(
                    "docker",
                    "logs",
                    cid,
                ),
            )
            s.close()
            assert finished.wait(5)
            expected_closed = path.endswith("/other")
            assert results[-1] == (
                path,
                expected_closed,
                "fixture-editor",
            ), results[-1]
        print(
            "OK: Frühe Dashboard-Abbrüche abgefangen; andere APIs brechen ab; Identität weitergereicht.",
            flush=True,
        )
        # Grenze reproduzieren: Bei Schreibfehlern kann Nginx große Antworten abbrechen.
        started.clear()
        finished.clear()
        s = connect()
        s.sendall(
            b"POST /grafana/api/ds/query?large-response=1 HTTP/1.1\r\nHost: alex-schneider-dev.de\r\nCookie: test=allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        )
        assert started.wait(5)
        s.close()
        assert finished.wait(10)
        assert results[-1] == (
            "large-response",
            True,
        ), results[-1]
        print(
            "GRENZE REPRODUZIERT: Große Antworten verursachen nach Browser-Abbruch weiterhin Schreibfehler.",
            flush=True,
        )
        with connect() as s:
            s.sendall(
                b"GET /grafana/d/test/failure HTTP/1.1\r\nHost: alex-schneider-dev.de\r\nCookie: test=allowed\r\nConnection: close\r\n\r\n"
            )
            assert b" 500 " in s.recv(4096)
        print(
            "OK: HTTP 500 bleibt sichtbar.",
            flush=True,
        )
        started.clear()
        finished.clear()
        s = connect()
        s.sendall(
            b"GET /grafana/api/live/ws HTTP/1.1\r\nHost: alex-schneider-dev.de\r\nCookie: test=allowed\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
        )
        assert b" 101 " in s.recv(4096)
        s.close()
        assert finished.wait(5) and results[-1] == (
            "ws",
            True,
        ), results[-1]
        print(
            "OK: Live-WebSocket-Abbruch erreicht das Backend.",
            flush=True,
        )
finally:
    if cid:
        cmd(
            "docker",
            "rm",
            "-f",
            cid,
        )
    cmd(
        "docker",
        "network",
        "rm",
        network,
    )
    server.shutdown()
