const express = require("express");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/steps?cr_id=X
router.get("/", async (req, res) => {
  const { cr_id } = req.query;
  if (!cr_id) return res.status(400).json({ error: "cr_id is required" });
  try {
    const { rows } = await pool.query(
      `
      SELECT ds.*,
             ua.full_name AS assigned_to_name,
             ue.full_name AS executed_by_name
      FROM deployment_steps ds
      LEFT JOIN users ua ON ua.id = ds.assigned_to
      LEFT JOIN users ue ON ue.id = ds.executed_by
      WHERE ds.cr_id = $1
      ORDER BY ds.step_number
    `,
      [cr_id],
    );
    res.json({ steps: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/steps
router.post("/", async (req, res) => {
  const {
    cr_id,
    step_number,
    title,
    description,
    command,
    expected_result,
    rollback_cmd,
    assigned_to,
    duration_min,
  } = req.body;
  if (!cr_id || !step_number || !title)
    return res
      .status(400)
      .json({ error: "cr_id, step_number, title required" });
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO deployment_steps
        (cr_id, step_number, title, description, command, expected_result, rollback_cmd, assigned_to, duration_min)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
      [
        cr_id,
        step_number,
        title,
        description,
        command,
        expected_result,
        rollback_cmd,
        assigned_to || null,
        duration_min || 5,
      ],
    );
    res.status(201).json({ step: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/steps/:id  — update step status (start / done / fail)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  let startedAt = null;
  let completedAt = null;
  let executedBy = null;

  if (status === "in_progress") {
    startedAt = new Date();
    executedBy = req.user.id;
  } else if (
    status === "completed" ||
    status === "failed" ||
    status === "skipped"
  ) {
    completedAt = new Date();
    executedBy = req.user.id;
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE deployment_steps
      SET status       = COALESCE($1, status),
          notes        = COALESCE($2, notes),
          started_at   = COALESCE($3, started_at),
          completed_at = COALESCE($4, completed_at),
          executed_by  = COALESCE($5, executed_by)
      WHERE id = $6
      RETURNING *
    `,
      [status, notes, startedAt, completedAt, executedBy, id],
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const step = rows[0];

    // Log deployment event
    await pool.query(
      `
      INSERT INTO deployment_events (cr_id, event_type, message, severity, user_id)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        step.cr_id,
        status === "completed"
          ? "step_done"
          : status === "failed"
            ? "step_failed"
            : "step_started",
        `Step ${step.step_number}: "${step.title}" marked as ${status}`,
        status === "failed"
          ? "error"
          : status === "completed"
            ? "success"
            : "info",
        req.user.id,
      ],
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`cr-${step.cr_id}`).emit("step:updated", step);
    }

    res.json({ step });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/steps/cr/:cr_id/event  — add manual event/comment to deployment log
router.post("/cr/:cr_id/event", async (req, res) => {
  const { cr_id } = req.params;
  const { event_type = "comment", message, severity = "info" } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO deployment_events (cr_id, event_type, message, severity, user_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `,
      [cr_id, event_type, message, severity, req.user.id],
    );

    const io = req.app.get("io");
    if (io) io.to(`cr-${cr_id}`).emit("event:new", rows[0]);

    res.status(201).json({ event: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
