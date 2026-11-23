#!/usr/bin/python3
"""Nur lesendes Swarm-Inventar ohne Secrets; als root-eigene Datei installieren."""
import json
import re
import subprocess
import sys

from errors.messages import ERRORS


def docker(*args):
    return subprocess.check_output(
        [
            "/usr/bin/docker",
            "--host",
            "unix:///var/run/docker.sock",
            *args,
        ],
        text=True,
    ).strip()


def repository(image):
    name = image.split("@", 1)[0]
    # Ein Port im Registry-Hostnamen ist kein Image-Tag.
    head, separator, tail = name.rpartition("/")
    return head + separator + tail.split(":", 1)[0]


def capture():
    rows = []
    for stack in (
        "projekt",
        "projekt-edge",
        "observability",
    ):
        ids = docker("service", "ls", "--filter", "label=com.docker.stack.namespace=" + stack, "-q").split()
        if not ids:
            raise ValueError(ERRORS["stack"] + stack)
        for service_id in ids:
            line = docker(
                "service",
                "inspect",
                service_id,
                "--format",
                "{{.Spec.Name}} {{.Spec.TaskTemplate.ContainerSpec.Image}}",
            )
            name, desired = line.split()
            if not re.fullmatch(r"(projekt|projekt-edge|observability)_[a-zA-Z0-9_-]+", name):
                raise ValueError(ERRORS["service"])
            task_ids = docker(
                "service",
                "ps",
                service_id,
                "--filter",
                "desired-state=running",
                "-q",
                "--no-trunc",
            ).split()
            running = docker(
                "service",
                "ps",
                service_id,
                "--no-trunc",
                "--format",
                "{{.ID}} {{.CurrentState}}",
            )
            running_ids = {
                line.split()[0]
                for line in running.splitlines()
                if len(line.split()) > 1 and line.split()[1] == "Running"
            }
            if running_ids != set(task_ids):
                raise ValueError(name + ERRORS["transition"])
            images = set()
            for task_id in task_ids:
                # Nur Status, Image und Container-ID lesen; keine Umgebungsvariablen oder Secrets.
                task = json.loads(
                    docker(
                        "inspect",
                        "--type",
                        "task",
                        task_id,
                        "--format",
                        '{"state":{{json .Status.State}},"image":{{json .Spec.ContainerSpec.Image}},"container":{{json .Status.ContainerStatus.ContainerID}}}',
                    )
                )
                if task["state"] != "running" or task["image"] != desired:
                    raise ValueError(name + ERRORS["rollout"])
                image = task["image"]
                if "@sha256:" not in image:
                    # Tags ausschließlich aus dem tatsächlich laufenden lokalen Container auflösen.
                    image_id = docker("container", "inspect", task["container"], "--format", "{{.Image}}")
                    digests = json.loads(docker("image", "inspect", image_id, "--format", "{{json .RepoDigests}}"))
                    matches = [d for d in (digests or []) if repository(d) == repository(image)]
                    if len(matches) != 1:
                        raise ValueError(name + ERRORS["pin"])
                    image = matches[0]
                images.add(image)
            if not task_ids:
                raise ValueError(name + ERRORS["empty"])
            if len(images) != 1:
                raise ValueError(name + ERRORS["mixed"])
            if (
                docker(
                    "service",
                    "inspect",
                    service_id,
                    "--format",
                    "{{.Spec.Name}} {{.Spec.TaskTemplate.ContainerSpec.Image}}",
                )
                != line
            ):
                raise ValueError(name + ERRORS["changed"])
            image = images.pop()
            if not re.fullmatch(r"[a-z0-9][a-zA-Z0-9._/:\-]*@sha256:[a-f0-9]{64}", image):
                raise ValueError(name + ERRORS["digest"])
            rows.append(name + " " + image)
    return "\n".join(sorted(rows)) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 1:
        sys.exit(ERRORS["arguments"])
    try:
        # Erst nach vollständiger Prüfung ausgeben; keine partiellen Exporte.
        print(capture(), end="")
    except (
        ValueError,
        subprocess.CalledProcessError,
        KeyError,
    ) as error:
        sys.exit(ERRORS["failed"] + str(error))
