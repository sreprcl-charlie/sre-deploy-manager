const pool = require("./pool");

const SQL = `
-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(100) UNIQUE NOT NULL,
  full_name   VARCHAR(200) NOT NULL,
  email       VARCHAR(200) UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'sre',  -- sre | cab | lead | viewer
  team        VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CHANGE REQUESTS (CAB approved)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id                  SERIAL PRIMARY KEY,
  cr_number           VARCHAR(50) UNIQUE NOT NULL,   -- e.g. CHG0012345
  title               TEXT NOT NULL,
  description         TEXT,
  change_type         VARCHAR(50) NOT NULL,           -- normal | emergency | standard
  priority            VARCHAR(20) NOT NULL DEFAULT 'medium', -- low|medium|high|critical
  environment         VARCHAR(50) NOT NULL,           -- prod | staging | dr
  affected_systems    TEXT[],
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  rollback_plan       TEXT,
  cab_approved_by     VARCHAR(200),
  cab_approved_at     TIMESTAMPTZ,
  status              VARCHAR(30) NOT NULL DEFAULT 'approved', -- approved|in_progress|completed|completed_with_notes|rolled_back
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CHECKPOINTS (pre-deployment coordination)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
  id              SERIAL PRIMARY KEY,
  cr_id           INTEGER REFERENCES change_requests(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  team            VARCHAR(100) NOT NULL,
  assigned_to     INTEGER REFERENCES users(id),
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending|in_progress|passed|failed|skipped
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  completed_by    INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- DEPLOYMENT STEPS (runbook)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deployment_steps (
  id              SERIAL PRIMARY KEY,
  cr_id           INTEGER REFERENCES change_requests(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  command         TEXT,
  expected_result TEXT,
  rollback_cmd    TEXT,
  assigned_to     INTEGER REFERENCES users(id),
  duration_min    INTEGER DEFAULT 5,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending|in_progress|completed|failed|skipped
  notes           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  executed_by     INTEGER REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- DEPLOYMENT EVENTS / AUDIT LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deployment_events (
  id          SERIAL PRIMARY KEY,
  cr_id       INTEGER REFERENCES change_requests(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,   -- step_started|step_done|step_failed|checkpoint_passed|comment|issue
  message     TEXT NOT NULL,
  severity    VARCHAR(20) DEFAULT 'info', -- info|warning|error|success
  user_id     INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: update updated_at on change_requests
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cr_updated_at ON change_requests;
CREATE TRIGGER trg_cr_updated_at
  BEFORE UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

async function migrate() {
  let client;
  try {
    console.log("[migrate] Running migrations...");
    client = await pool.connect();
    await client.query(SQL);
    console.log("[migrate] ✓ All tables created / verified.");
  } catch (err) {
    console.error("[migrate] ✗ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
