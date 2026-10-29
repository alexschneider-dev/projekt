import importlib.util
import json
import pathlib
import unittest


spec = importlib.util.spec_from_file_location(
    "health",
    pathlib.Path(__file__).with_name("check-health.py"),
)
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class HealthCheckTests(unittest.TestCase):
    def run_check(
        self,
        missing=None,
        down=None,
        redis="1",
        archive_warning=False,
        es="1",
    ):
        jobs = [
            "grafana",
            "prometheus",
            "loki",
            "tempo",
            "alloy",
            "node",
            "cadvisor",
            "swarm-exporter",
            "nginx-exporter",
            "postgres-exporter",
            "redis-exporter",
            "elasticsearch-exporter",
            "nextjs",
            "thanos-query",
            "thanos-sidecar",
            "thanos-store",
            "thanos-compact",
        ]

        def fetch(url):
            if url.endswith("/targets"):
                return json.dumps(
                    {
                        "status": "success",
                        "data": {
                            "activeTargets": [
                                {
                                    "labels": {"job": job},
                                    "health": "down" if job == down else "up",
                                }
                                for job in jobs
                                if job != missing
                            ]
                        },
                    }
                )
            if "thanos-query" in url and archive_warning:
                return json.dumps(
                    {
                        "status": "success",
                        "warnings": ["store unavailable"],
                        "data": {
                            "result": [
                                {
                                    "value": [
                                        0,
                                        "1",
                                    ]
                                }
                            ]
                        },
                    }
                )
            if "elasticsearch_cluster_health_status" in url:
                return json.dumps(
                    {
                        "status": "success",
                        "data": {
                            "result": (
                                []
                                if es is None
                                else [
                                    {
                                        "value": [
                                            0,
                                            es,
                                        ]
                                    }
                                ]
                            )
                        },
                    }
                )
            if "/query?" in url:
                return json.dumps(
                    {
                        "status": "success",
                        "data": {
                            "result": [
                                {
                                    "metric": {"__name__": name},
                                    "value": [
                                        0,
                                        redis if name == "redis_up" else "1",
                                    ],
                                }
                                for name in [
                                    "pg_up",
                                    "redis_up",
                                    "nginx_up",
                                ]
                            ]
                        },
                    }
                )
            return b"OK"

        health.check(fetch)

    def test_healthy(self):
        self.run_check()

    def test_missing_discovery_is_failure(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "Fehlende Jobs",
        ):
            self.run_check(missing="tempo")

    def test_failed_scrape_is_failure(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "nicht erreichbare Ziele",
        ):
            self.run_check(down="nextjs")

    def test_exporter_up_but_redis_down_is_failure(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "nicht erreichen",
        ):
            self.run_check(redis="0")

    def test_partial_archive_response_is_failure(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "unvollständige Ergebnisse",
        ):
            self.run_check(archive_warning=True)

    def test_missing_or_red_elasticsearch_is_failure(self):
        for state in [
            None,
            "0",
        ]:
            with self.assertRaisesRegex(
                RuntimeError,
                "Elasticsearch",
            ):
                self.run_check(es=state)
