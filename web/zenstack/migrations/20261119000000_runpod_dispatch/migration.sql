-- Dispatcher-owned durable state, intentionally separate from the client ORM.
CREATE TABLE scan_runpod_dispatch (
    job_id TEXT PRIMARY KEY REFERENCES scan_job(id) ON DELETE CASCADE,
    remote_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
