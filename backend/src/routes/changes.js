const express = require("express");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/changes  — list all change requests
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cr.*, u.full_name AS created_by_name
      FROM change_requests cr
      LEFT JOIN users u ON u.id = cr.created_by
      ORDER BY cr.scheduled_start DESC
    `);
    res.json({ changes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/changes/:id  — single CR with checkpoints + steps
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: crRows } = await pool.query(
      `
      SELECT cr.*, u.full_name AS created_by_name
      FROM change_requests cr
      LEFT JOIN users u ON u.id = cr.created_by
      WHERE cr.id = $1
    `,
      [id],
    );
    if (!crRows.length) return res.status(404).json({ error: "Not found" });

    const [checkpoints, steps, events] = await Promise.all([
      pool.query(
        `
        SELECT cp.*, 
               ua.full_name AS assigned_to_name,
               uc.full_name AS completed_by_name
        FROM checkpoints cp
        LEFT JOIN users ua ON ua.id = cp.assigned_to
        LEFT JOIN users uc ON uc.id = cp.completed_by
        WHERE cp.cr_id = $1 ORDER BY cp.order_index
      `,
        [id],
      ),
      pool.query(
        `
        SELECT ds.*,
               ua.full_name AS assigned_to_name,
               ue.full_name AS executed_by_name
        FROM deployment_steps ds
        LEFT JOIN users ua ON ua.id = ds.assigned_to
        LEFT JOIN users ue ON ue.id = ds.executed_by
        WHERE ds.cr_id = $1 ORDER BY ds.step_number
      `,
        [id],
      ),
      pool.query(
        `
        SELECT de.*, u.full_name AS user_name, u.role
        FROM deployment_events de
        LEFT JOIN users u ON u.id = de.user_id
        WHERE de.cr_id = $1 ORDER BY de.created_at DESC
      `,
        [id],
      ),
    ]);

    res.json({
      change: crRows[0],
      checkpoints: checkpoints.rows,
      steps: steps.rows,
      events: events.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/changes  — create new CR
router.post("/", async (req, res) => {
  const {
    cr_number,
    title,
    description,
    change_type,
    priority,
    environment,
    affected_systems,
    scheduled_start,
    scheduled_end,
    rollback_plan,
    cab_approved_by,
    cab_approved_at,
    checkpoints = [],
    steps = [],
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO change_requests
        (cr_number, title, description, change_type, priority, environment,
         affected_systems, scheduled_start, scheduled_end,
         rollback_plan, cab_approved_by, cab_approved_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `,
      [
        cr_number,
        title,
        description,
        change_type,
        priority,
        environment,
        affected_systems,
        scheduled_start,
        scheduled_end,
        rollback_plan,
        cab_approved_by,
        cab_approved_at,
        req.user.id,
      ],
    );

    const cr = rows[0];

    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      await client.query(
        `
        INSERT INTO checkpoints (cr_id, name, description, team, assigned_to, order_index)
        VALUES ($1,$2,$3,$4,$5,$6)
      `,
        [cr.id, cp.name, cp.description, cp.team, cp.assigned_to || null, i],
      );
    }

    for (const step of steps) {
      await client.query(
        `
        INSERT INTO deployment_steps
          (cr_id, step_number, title, description, command, expected_result, rollback_cmd, assigned_to, duration_min)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
        [
          cr.id,
          step.step_number,
          step.title,
          step.description,
          step.command,
          step.expected_result,
          step.rollback_cmd,
          step.assigned_to || null,
          step.duration_min || 5,
        ],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ change: cr });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505")
      return res.status(409).json({ error: "CR number already exists" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// PATCH /api/changes/:id  — update status or fields
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const allowed = [
    "status",
    "title",
    "description",
    "rollback_plan",
    "scheduled_start",
    "scheduled_end",
  ];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(req.body[key]);
    }
  }
  if (!updates.length)
    return res.status(400).json({ error: "No valid fields to update" });

  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE change_requests SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ change: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/changes/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM change_requests WHERE id = $1", [id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
