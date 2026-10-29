import unittest
from unittest.mock import Mock

from nginx_test_network import backend_address


class BackendAddressTests(unittest.TestCase):
    def test_linux_uses_bridge_gateway_without_dns(self):
        command = Mock(return_value="172.19.0.1")
        backend, resolve = backend_address(
            "Linux",
            "isolated-test",
            12345,
            command,
        )
        self.assertEqual(
            (
                backend,
                resolve,
            ),
            (
                "172.19.0.1:12345",
                "",
            ),
        )
        command.assert_called_once_with(
            "docker",
            "network",
            "inspect",
            "isolated-test",
            "--format",
            "{{(index .IPAM.Config 0).Gateway}}",
        )

    def test_mac_keeps_docker_host_dns(self):
        command = Mock()
        self.assertEqual(
            backend_address(
                "Darwin",
                "isolated-test",
                12345,
                command,
            ),
            (
                "host.docker.internal:12345",
                " resolve",
            ),
        )
        command.assert_not_called()
