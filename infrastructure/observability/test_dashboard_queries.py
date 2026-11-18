import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "query_classification_integration",
    Path(__file__).with_name("test-query-classification-integration.py"),
)
classification = importlib.util.module_from_spec(spec)
spec.loader.exec_module(classification)


class DashboardQueriesTest(unittest.TestCase):
    def test_monorepo_dashboard_is_loaded_outside_repository(self):
        # Derselbe Einstieg wie im Integrationstest muss ohne Repository-CWD funktionieren.
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                error, diagnostic = classification.dashboard_queries()
            finally:
                os.chdir(previous)

        self.assertIn('environment="production"', error)
        self.assertIn('query_event!~"canceled|scheduler_stream_closed|response_peer_closed"', error)
        self.assertIn('query_event=~"canceled|scheduler_stream_closed|response_peer_closed"', diagnostic)
        self.assertIn('${service:regex}', diagnostic)
