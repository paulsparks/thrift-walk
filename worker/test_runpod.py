"""Transfer boundaries, isolated artifacts, and restart-safe dispatch behavior."""
import hashlib
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests

os.environ.setdefault("SCAN_APP_ORIGIN", "https://app.example.com")

import runpod_dispatcher as dispatch
import runpod_handler as worker


class Transfers(unittest.TestCase):
    def test_rejects_arbitrary_hosts_and_redirect_targets(self):
        for url in (worker.ORIGIN.replace("https://", "http://") + "/api/scan-transfer/a/b",
                    worker.ORIGIN + ".evil.test/api/scan-transfer/a/b",
                    "https://localhost/api/scan-transfer/a/b", "file:///etc/passwd"):
            with self.assertRaises(ValueError):
                worker.checked_url(url)

    def test_valid_signature_vector(self):
        url = dispatch.signed_url("s" * 32, "GET", "scan-1", "01.jpg", 2000000000)
        self.assertIn("token=", url)
        with self.assertRaises(ValueError):
            dispatch.signed_url("s" * 32, "GET", "../scan", "01.jpg", 2000000000)

    def test_corrupt_or_partial_receipt_never_publishes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "model.glb").write_bytes(b"glTFmodel")
            (root / "preview.png").write_bytes(b"\x89PNG\r\n\x1a\npreview")
            manifest = {n: hashlib.sha256((root / n).read_bytes()).hexdigest() for n in ("model.glb", "preview.png")}
            self.assertFalse(dispatch.receipt_valid(root))
            (root / "result.json").write_text(json.dumps(manifest))
            self.assertTrue(dispatch.receipt_valid(root))
            (root / "model.glb").write_bytes(b"corrupt")
            self.assertFalse(dispatch.receipt_valid(root))

    def test_handler_limit_and_upload_order(self):
        sdk = types.SimpleNamespace(serverless=MagicMock())
        def reconstruct(photos, out, **kw):
            self.assertEqual([p.suffix for p in photos], [".jpg"] * 3)
            self.assertEqual(len(set(photos)), 3)
            out.write_bytes(b"glTFmodel")
        pipeline = types.SimpleNamespace(run_pipeline=reconstruct)
        preview = types.SimpleNamespace(generate_preview=lambda p: p.with_name("preview.png").write_bytes(b"\x89PNG\r\n\x1a\npreview"))
        urls = {n: f"{worker.ORIGIN}/api/scan-transfer/scan/{n}" for n in ("model.glb", "preview.png", "result.json")}
        response = MagicMock()
        response.__enter__.return_value = response
        response.iter_content.return_value = [b"photo"]
        with patch.dict(sys.modules, {"runpod": sdk, "pipeline": pipeline, "preview": preview}), patch.object(worker, "transfer", return_value=response) as transfer:
            with self.assertRaises(ValueError):
                worker.handler({"input": {"photos": ["x"] * 11}})
            result = worker.handler({"input": {"photos": [f"{worker.ORIGIN}/api/scan-transfer/scan/01.jpg"] * 3, "outputs": urls}})
            self.assertTrue(result["uploaded"])
            puts = [c.args[1] for c in transfer.call_args_list if c.args[0] == "PUT"]
            self.assertEqual(puts, list(urls.values()))

    def test_oversize_download_stops_before_pipeline(self):
        pipeline = types.SimpleNamespace(run_pipeline=MagicMock())
        response = MagicMock()
        response.__enter__.return_value = response
        response.iter_content.return_value = [b"x" * 11]
        urls = {n: f"{worker.ORIGIN}/api/scan-transfer/scan/{n}" for n in ("model.glb", "preview.png", "result.json")}
        with patch.dict(sys.modules, {"runpod": MagicMock(), "pipeline": pipeline, "preview": MagicMock()}), patch.object(worker, "transfer", return_value=response), patch.object(worker, "MAX_PHOTO_BYTES", 10):
            with self.assertRaises(ValueError):
                worker.handler({"input": {"photos": [f"{worker.ORIGIN}/api/scan-transfer/scan/01.jpg"] * 3, "outputs": urls}})
            pipeline.run_pipeline.assert_not_called()


class DispatchRecovery(unittest.TestCase):
    def test_prisma_schema_option_is_removed_without_losing_libpq_options(self):
        self.assertEqual(
            dispatch.postgres_url("postgresql://user:pass@localhost/db?schema=public&sslmode=require"),
            "postgresql://user:pass@localhost/db?sslmode=require",
        )

    def test_unconfirmed_submission_is_not_resubmitted_after_restart(self):
        conn = MagicMock()
        conn.execute.return_value.fetchall.side_effect = [ [("scan-1", [], None, 2000000000)], [] ]
        conn.execute.return_value.fetchone.side_effect = [(1,), None]
        session = MagicMock()
        with tempfile.TemporaryDirectory() as tmp, patch.object(dispatch.time, "time", return_value=1900000000):
            dispatch.tick(conn, Path(tmp), "endpoint", "s" * 32, session)
        session.post.assert_not_called()
        session.get.assert_not_called()

    def test_three_outstanding_scans_prevent_more_submissions(self):
        conn = MagicMock()
        conn.execute.return_value.fetchall.side_effect = [[], []]
        conn.execute.return_value.fetchone.return_value = (3,)
        session = MagicMock()
        dispatch.tick(conn, Path("/tmp"), "endpoint", "s" * 32, session)
        session.post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
