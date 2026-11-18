import sys
from pathlib import Path
import http.client
import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "errors"),
)
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "errors"),
)
from messages import ERRORS


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(
            socket.AF_UNIX,
            socket.SOCK_STREAM,
        )
        self.sock.settimeout(5)
        self.sock.connect("/var/run/docker.sock")


def get(path):
    connection = DockerConnection(
        "localhost",
        timeout=5,
    )
    try:
        connection.request(
            "GET",
            path,
        )
        response = connection.getresponse()
        if response.status != 200:
            raise RuntimeError(ERRORS["E1"])
        return json.loads(response.read())
    finally:
        connection.close()


def metrics():
    version = get("/version")["ApiVersion"]
    services = get("/v" + version + "/services?status=true")
    tasks = get("/v" + version + "/tasks")
    lines = [
        "# TYPE swarm_collection_success gauge",
        "swarm_collection_success 1",
    ]
    for service in services:
        spec = service["Spec"]
        name = spec["Name"]
        if not name.startswith(
            (
                "projekt_",
                "projekt-edge_",
                "observability_",
            )
        ):
            continue
        status = service.get("ServiceStatus")
        replicated = spec.get(
            "Mode",
            {},
        ).get("Replicated")
        if replicated is None and status is None:
            continue
        desired = (
            status["DesiredTasks"]
            if status
            else replicated.get(
                "Replicas",
                1,
            )
        )
        running = sum(
            t.get("ServiceID") == service["ID"]
            and t.get("DesiredState") == "running"
            and t.get(
                "Status",
                {},
            ).get("State")
            == "running"
            for t in tasks
        )
        if status:
            running = status["RunningTasks"]
        label = "{service=" + json.dumps(name) + "}"
        lines.extend(
            [
                "swarm_service_desired_replicas" + label + " " + str(desired),
                "swarm_service_running_replicas" + label + " " + str(running),
            ]
        )
    return "\n".join(lines) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_error(404)
            return
        try:
            body = metrics()
        except Exception:
            body = "swarm_collection_success 0\n"
        self.send_response(200)
        self.send_header(
            "Content-Type",
            "text/plain; version=0.0.4",
        )
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(
        self,
        *args,
    ):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(
        (
            "0.0.0.0",
            9510,
        ),
        Handler,
    ).serve_forever()
