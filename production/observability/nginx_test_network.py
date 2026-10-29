import ipaddress


def backend_address(
    system,
    network,
    port,
    command,
):
    # Nginx' dynamischer Resolver liest keine --add-host-Einträge.
    if system == "Linux":
        gateway = command(
            "docker",
            "network",
            "inspect",
            network,
            "--format",
            "{{(index .IPAM.Config 0).Gateway}}",
        )
        return (
            f"{ipaddress.IPv4Address(gateway)}:{port}",
            "",
        )
    return (
        f"host.docker.internal:{port}",
        " resolve",
    )
