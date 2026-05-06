const pool = require("./pool");
const bcrypt = require("bcryptjs");

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

-- ─────────────────────────────────────────────
-- MIGRATION: Step progress tracking flags
-- ─────────────────────────────────────────────
ALTER TABLE deployment_steps
  ADD COLUMN IF NOT EXISTS is_adjusted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_edited   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- ─────────────────────────────────────────────
-- MIGRATION: Roles & product type
-- ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'all';

-- ─────────────────────────────────────────────
-- MIGRATION: Change squad
-- ─────────────────────────────────────────────
ALTER TABLE change_requests
  ADD COLUMN IF NOT EXISTS change_squad VARCHAR(20) DEFAULT 'non_core';

-- ─────────────────────────────────────────────
-- MIGRATION: Digital signature / approval
-- ─────────────────────────────────────────────
ALTER TABLE change_requests
  ADD COLUMN IF NOT EXISTS signature_data     TEXT,
  ADD COLUMN IF NOT EXISTS signature_user_id  INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS signature_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_name     VARCHAR(200);
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function migrate() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.error(
      "[migrate] ✗ No database configured. Set DATABASE_URL (Railway) or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.",
    );
    process.exit(1);
  }

  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    try {
      console.log(
        `[migrate] Running migrations... (attempt ${attempt}/${maxRetries})`,
      );
      console.log(
        "[migrate] Connecting to DB...",
        process.env.DATABASE_URL
          ? "(DATABASE_URL)"
          : `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      );
      client = await pool.connect();
      await client.query(SQL);
      console.log("[migrate] ✓ All tables created / verified.");
      client.release();

      // Seed approver user jika belum ada
      await seedApprover();

      await pool.end();
      return;
    } catch (err) {
      if (client) client.release();
      console.error(
        `[migrate] ✗ Attempt ${attempt} failed:`,
        err.message || err.code || JSON.stringify(err),
      );
      if (attempt < maxRetries) {
        console.log(`[migrate] Retrying in ${retryDelay / 1000}s...`);
        await sleep(retryDelay);
      } else {
        console.error("[migrate] ✗ All retries exhausted. Exiting.");
        await pool.end().catch(() => {});
        process.exit(1);
      }
    }
  }
}

async function seedApprover() {
  const username = "slamet.widodo";
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [username],
  );
  if (rows.length) {
    console.log("[migrate] Approver user already exists, skipping seed.");
    return;
  }
  const hash = await bcrypt.hash("slamet123", 12);
  await pool.query(
    `INSERT INTO users (username, full_name, email, password, role, team, product_type)
     VALUES ($1,$2,$3,$4,'approver','Core Team','core')`,
    [username, "Slamet Widodo", "slamet.widodo@company.com", hash],
  );
  console.log("[migrate] ✓ Approver user slamet.widodo created.");
}

migrate();
