const express = require("express");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/checkpoints?cr_id=X
router.get("/", async (req, res) => {
  const { cr_id } = req.query;
  if (!cr_id) return res.status(400).json({ error: "cr_id is required" });
  try {
    const { rows } = await pool.query(
      `
      SELECT cp.*, ua.full_name AS assigned_to_name, uc.full_name AS completed_by_name
      FROM checkpoints cp
      LEFT JOIN users ua ON ua.id = cp.assigned_to
      LEFT JOIN users uc ON uc.id = cp.completed_by
      WHERE cp.cr_id = $1
      ORDER BY cp.order_index
    `,
      [cr_id],
    );
    res.json({ checkpoints: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/checkpoints  — add checkpoint to a CR
router.post("/", async (req, res) => {
  const { cr_id, name, description, team, assigned_to, order_index } = req.body;
  if (!cr_id || !name || !team)
    return res.status(400).json({ error: "cr_id, name, team required" });
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO checkpoints (cr_id, name, description, team, assigned_to, order_index)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `,
      [cr_id, name, description, team, assigned_to || null, order_index ?? 0],
    );
    res.status(201).json({ checkpoint: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/checkpoints/:id  — update status, notes
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    let completedAt = undefined;
    let completedBy = undefined;
    if (status === "passed" || status === "failed") {
      completedAt = new Date();
      completedBy = req.user.id;
    }

    const { rows } = await pool.query(
      `
      UPDATE checkpoints
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          completed_at = COALESCE($3, completed_at),
          completed_by = COALESCE($4, completed_by)
      WHERE id = $5
      RETURNING *
    `,
      [status, notes, completedAt || null, completedBy || null, id],
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    // emit via socket (attached in server.js)
    const io = req.app.get("io");
    if (io) {
      io.to(`cr-${rows[0].cr_id}`).emit("checkpoint:updated", rows[0]);
    }

    res.json({ checkpoint: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/checkpoints/:id
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM checkpoints WHERE id = $1", [req.params.id]);
  res.json({ message: "Deleted" });
});

module.exports = router;
