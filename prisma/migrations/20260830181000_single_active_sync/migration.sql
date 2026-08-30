-- Prevent two cron/manual requests from owning the active sync lease at once.
-- Completed and failed runs remain unlimited because the predicate only covers RUNNING.
CREATE UNIQUE INDEX IF NOT EXISTS "sync_run_single_running_idx"
ON "sync_run" ((1))
WHERE "status" = 'RUNNING';
