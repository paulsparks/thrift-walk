"""Real SQL integration; opt in with TEST_RUNPOD_DB_URL pointing at a disposable DB."""
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import MagicMock

import psycopg
import requests
from psycopg import sql

os.environ.setdefault("SCAN_APP_ORIGIN", "https://app.example.com")

import runpod_dispatcher as dispatch


@unittest.skipUnless(os.environ.get("TEST_RUNPOD_DB_URL"), "requires disposable PostgreSQL")
class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg.connect(os.environ["TEST_RUNPOD_DB_URL"], autocommit=True)
        self.schema = "test_runpod_" + uuid.uuid4().hex
        self.conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema)))
        self.conn.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(self.schema)))
        self.conn.execute('''CREATE TABLE scan_job (id TEXT PRIMARY KEY, status TEXT DEFAULT 'Pending',
            "imagePaths" TEXT[], progress INT DEFAULT 0, "glbPath" TEXT, error TEXT,
            "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())''')
        migration = Path(__file__).parents[1] / "web/zenstack/migrations/20261119000000_runpod_dispatch/migration.sql"
        self.conn.execute(migration.read_text())
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.session = MagicMock()
        self.session.post.return_value.json.return_value = {"id": "remote-1"}
        self.session.get.return_value.status_code = 200
        self.session.get.return_value.json.return_value = {"status": "IN_QUEUE"}

    def tearDown(self):
        self.conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema)))
        self.conn.close()
        self.tmp.cleanup()

    def add(self, job_id):
        self.conn.execute('INSERT INTO scan_job(id,"imagePaths") VALUES (%s,%s)', (job_id, [f"{job_id}/{i}.jpg" for i in range(3)]))

    def tick(self):
        dispatch.tick(self.conn, self.root, "test-endpoint", "s" * 32, self.session)

    def test_claims_max_three_and_restart_polls_without_resubmit(self):
        for i in range(4): self.add(f"job-{i}")
        self.tick()
        self.assertEqual(self.session.post.call_count, 3)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM scan_runpod_dispatch").fetchone()[0], 3)
        self.tick()
        self.assertEqual(self.session.post.call_count, 3)
        self.assertEqual(self.session.get.call_count, 3)

    def test_lost_submission_response_is_durable_and_not_retried(self):
        self.add("job")
        self.session.post.side_effect = requests.Timeout()
        self.tick()
        self.assertEqual(self.conn.execute("SELECT remote_id FROM scan_runpod_dispatch").fetchone(), (None,))
        self.tick()
        self.assertEqual(self.session.post.call_count, 1)
        self.conn.execute("UPDATE scan_runpod_dispatch SET expires_at=now()-interval '2 minutes'")
        self.tick()
        self.assertEqual(self.conn.execute("SELECT status FROM scan_job").fetchone(), ("Failed",))

    def test_receipt_publishes_and_removes_only_originals(self):
        import hashlib
        import json
        self.add("job")
        self.tick()
        folder = self.root / "job"
        folder.mkdir()
        for i in range(3): (folder / f"{i}.jpg").write_bytes(b"original")
        (folder / "model.glb").write_bytes(b"glTFmodel")
        (folder / "preview.png").write_bytes(b"\x89PNG\r\n\x1a\npreview")
        (folder / "result.json").write_text(json.dumps({n: hashlib.sha256((folder / n).read_bytes()).hexdigest() for n in ("model.glb", "preview.png")}))
        self.tick()
        self.assertEqual(self.conn.execute('SELECT status,progress,"imagePaths","glbPath" FROM scan_job').fetchone(), ("Completed", 100, [], "job/model.glb"))
        self.assertFalse((folder / "0.jpg").exists())
        self.assertTrue((folder / "model.glb").exists())


if __name__ == "__main__": unittest.main()
