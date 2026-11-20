"""Queue-loop regressions; no database, Redis server or GPU required."""

import unittest
from unittest.mock import MagicMock, patch

import redis

import run_worker


class QueueLoopTests(unittest.TestCase):
    def run_loop(self, replies):
        queue = MagicMock()
        queue.brpop.side_effect = replies
        env = {
            "SCAN_STORAGE_DIR": "/tmp/thriftwalk-worker-test",
            "DATABASE_URL": "postgresql://localhost/test",
            "REDIS_URL": "redis://localhost:6379",
        }
        with (
            patch.dict(run_worker.os.environ, env),
            patch.object(
                run_worker.redis.Redis, "from_url", return_value=queue
            ) as factory,
            patch.object(run_worker.psycopg, "connect"),
            patch.object(run_worker, "recover") as recover,
            patch.object(run_worker, "expire_stale"),
            patch.object(run_worker, "process") as process,
            patch.object(run_worker.time, "sleep") as sleep,
        ):
            run_worker.main()
        return factory, recover, process, sleep

    def test_empty_queue_keeps_polling_then_processes_job(self):
        factory, recover, process, sleep = self.run_loop(
            [None, None, (run_worker.QUEUE, '{"jobId":"scan-1"}'), KeyboardInterrupt]
        )
        self.assertGreater(
            factory.call_args.kwargs["socket_timeout"], run_worker.POP_TIMEOUT_SECONDS
        )
        recover.assert_called_once()
        process.assert_called_once()
        self.assertEqual(process.call_args.args[2], "scan-1")
        sleep.assert_not_called()

    def test_socket_timeout_reconnects_and_recovers_pending_jobs(self):
        _, recover, process, sleep = self.run_loop(
            [redis.TimeoutError("Timeout reading from socket"), KeyboardInterrupt]
        )
        self.assertEqual(recover.call_count, 2)
        sleep.assert_called_once_with(3)
        process.assert_not_called()


class PreviewPublicationTests(unittest.TestCase):
    def test_preview_is_generated_before_scan_is_published(self):
        from pathlib import Path

        events = []
        with (
            patch.object(run_worker, "claim", return_value=["job/photo.jpg"]),
            patch.object(
                run_worker,
                "run_pipeline",
                side_effect=lambda *a, **kw: events.append("model"),
            ),
            patch.object(
                run_worker,
                "generate_preview",
                side_effect=lambda *a: events.append("preview"),
            ),
            patch.object(
                run_worker, "complete", side_effect=lambda *a: events.append("complete")
            ),
            patch.object(run_worker, "discard_photos"),
        ):
            run_worker.process(MagicMock(), Path("/tmp/scan-test"), "job")
        self.assertEqual(events, ["model", "preview", "complete"])

    def test_preview_failure_does_not_publish_incomplete_scan(self):
        from pathlib import Path

        with (
            patch.object(run_worker, "claim", return_value=["job/photo.jpg"]),
            patch.object(run_worker, "run_pipeline"),
            patch.object(
                run_worker,
                "generate_preview",
                side_effect=RuntimeError("Render failed"),
            ),
            patch.object(run_worker, "complete") as complete,
            patch.object(run_worker, "fail") as fail,
            patch.object(run_worker, "discard_photos"),
        ):
            run_worker.process(MagicMock(), Path("/tmp/scan-test"), "job")
        complete.assert_not_called()
        fail.assert_called_once()


if __name__ == "__main__":
    unittest.main()
