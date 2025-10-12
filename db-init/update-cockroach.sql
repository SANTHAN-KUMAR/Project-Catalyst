ALTER TABLE defaultdb.audit_trail ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_audit_unprocessed ON defaultdb.audit_trail(processed, timestamp) WHERE processed = false;
