const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");
const { sync, getSyncStatus } = require("../services/ivantiSync");

router.use(authMiddleware);

// ── GET /api/ivanti/changes ─────────────────────────────────────────────────
// Query params: page, limit, search, status, priority, type, sort
router.get("/changes", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const priority = (req.query.priority || "").trim();
    const type = (req.query.type || "").trim();

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(
        `(change_number ILIKE $${idx} OR subject ILIKE $${idx} OR requested_by ILIKE $${idx} OR owner ILIKE $${idx})`,
      );
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`status ILIKE $${idx}`);
      params.push(status);
      idx++;
    }
    if (priority) {
      conditions.push(`priority ILIKE $${idx}`);
      params.push(priority);
      idx++;
    }
    if (type) {
      conditions.push(`change_type ILIKE $${idx}`);
      params.push(type);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ivanti_changes ${where}`, params),
      pool.query(
        `SELECT id, change_id, change_number, subject, status, priority, urgency,
                category, service, change_type, requested_by, owner, owner_team,
                scheduled_start, scheduled_end, synced_at, created_at_ivanti
         FROM ivanti_changes ${where}
         ORDER BY created_at_ivanti DESC NULLS LAST, id DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
    ]);

    const total = parseInt(countRes.rows[0].count);

    res.json({
      changes: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[ivanti] GET /changes error:", err);
    res.status(500).json({ error: "Failed to fetch Ivanti changes" });
  }
});

// ── GET /api/ivanti/changes/:id ─────────────────────────────────────────────
router.get("/changes/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM ivanti_changes WHERE id = $1",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[ivanti] GET /changes/:id error:", err);
    res.status(500).json({ error: "Failed to fetch change detail" });
  }
});

// ── GET /api/ivanti/meta — distinct values for filter dropdowns ─────────────
router.get("/meta", async (req, res) => {
  try {
    const [statuses, priorities, types, teams] = await Promise.all([
      pool.query(
        "SELECT DISTINCT status FROM ivanti_changes WHERE status IS NOT NULL ORDER BY status",
      ),
      pool.query(
        "SELECT DISTINCT priority FROM ivanti_changes WHERE priority IS NOT NULL ORDER BY priority",
      ),
      pool.query(
        "SELECT DISTINCT change_type FROM ivanti_changes WHERE change_type IS NOT NULL ORDER BY change_type",
      ),
      pool.query(
        "SELECT DISTINCT owner_team FROM ivanti_changes WHERE owner_team IS NOT NULL ORDER BY owner_team",
      ),
    ]);
    res.json({
      statuses: statuses.rows.map((r) => r.status),
      priorities: priorities.rows.map((r) => r.priority),
      types: types.rows.map((r) => r.change_type),
      teams: teams.rows.map((r) => r.owner_team),
    });
  } catch (err) {
    console.error("[ivanti] GET /meta error:", err);
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

// ── GET /api/ivanti/sync-status ─────────────────────────────────────────────
router.get("/sync-status", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as total, MAX(synced_at) as last_synced FROM ivanti_changes",
    );
    res.json({
      ...getSyncStatus(),
      totalInDb: parseInt(rows[0].total),
      lastSyncedAt: rows[0].last_synced,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

// ── POST /api/ivanti/sync — manual trigger (superuser/admin only) ───────────
router.post("/sync", async (req, res) => {
  const role = req.user?.role;
  if (!["superuser", "admin"].includes(role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  res.json({ message: "Sync triggered" });
  // run async, don't block response
  sync().catch((err) => console.error("[ivanti] Manual sync error:", err));
});

module.exports = router;
