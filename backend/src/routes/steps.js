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

// PATCH /api/steps/:id  — update step status, add adjustment note, or edit content
router.patch("/:id", async (req, res) => {
  if (req.user.role === "approver")
    return res.status(403).json({ error: "Approver tidak dapat mengubah step" });
  const { id } = req.params;
  const {
    // Status update
    status,
    notes,
    elapsed_str,
    // Content edit fields
    title,
    description,
    command,
    expected_result,
    rollback_cmd,
    duration_min,
    edit_reason,
    // Post-completion adjustment flag
    is_adjustment,
  } = req.body;

  const hasContentEdit = [
    title,
    description,
    command,
    expected_result,
    rollback_cmd,
    duration_min,
  ].some((v) => v !== undefined);

  if (hasContentEdit && !edit_reason) {
    return res
      .status(400)
      .json({ error: "edit_reason wajib diisi saat mengubah isi step" });
  }

  try {
    // Fetch current step to carry forward flags
    const { rows: curr } = await pool.query(
      "SELECT * FROM deployment_steps WHERE id = $1",
      [id],
    );
    if (!curr.length) return res.status(404).json({ error: "Not found" });
    const currentStep = curr[0];

    let startedAt = null;
    let completedAt = null;
    let executedBy = null;

    if (status === "in_progress") {
      startedAt = new Date();
      executedBy = req.user.id;
    } else if (["completed", "failed", "skipped"].includes(status)) {
      completedAt = new Date();
      executedBy = req.user.id;
    }

    const newIsEdited = hasContentEdit ? true : currentStep.is_edited;
    const newEditReason = hasContentEdit
      ? edit_reason
      : currentStep.edit_reason;
    const newIsAdjusted =
      is_adjustment && notes ? true : currentStep.is_adjusted;

    const { rows } = await pool.query(
      `
      UPDATE deployment_steps
      SET status          = COALESCE($1,  status),
          notes           = COALESCE($2,  notes),
          started_at      = COALESCE($3,  started_at),
          completed_at    = COALESCE($4,  completed_at),
          executed_by     = COALESCE($5,  executed_by),
          title           = COALESCE($6,  title),
          description     = COALESCE($7,  description),
          command         = COALESCE($8,  command),
          expected_result = COALESCE($9,  expected_result),
          rollback_cmd    = COALESCE($10, rollback_cmd),
          duration_min    = COALESCE($11, duration_min),
          is_edited       = $12,
          edit_reason     = $13,
          is_adjusted     = $14
      WHERE id = $15
      RETURNING *
    `,
      [
        status || null,
        notes || null,
        startedAt,
        completedAt,
        executedBy,
        title !== undefined ? title : null,
        description !== undefined ? description : null,
        command !== undefined ? command : null,
        expected_result !== undefined ? expected_result : null,
        rollback_cmd !== undefined ? rollback_cmd : null,
        duration_min !== undefined ? duration_min : null,
        newIsEdited,
        newEditReason,
        newIsAdjusted,
        id,
      ],
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const step = rows[0];

    // Determine what event to log
    let eventType, eventMsg, severity;
    if (hasContentEdit) {
      eventType = "step_edited";
      eventMsg = `Step ${step.step_number}: "${step.title}" isi diubah. Alasan: ${edit_reason}`;
      severity = "warning";
    } else if (is_adjustment && notes) {
      eventType = "step_adjusted";
      eventMsg = `Step ${step.step_number}: "${step.title}" — catatan adjustment: ${notes}`;
      severity = "warning";
    } else if (status === "completed") {
      const timeStr = completedAt.toLocaleTimeString("id-ID");
      eventType = "step_done";
      eventMsg = `Step ${step.step_number}: "${step.title}" selesai pukul ${timeStr}${elapsed_str ? ` (elapsed: ${elapsed_str})` : ""}`;
      severity = "success";
    } else if (status === "failed") {
      const timeStr = completedAt.toLocaleTimeString("id-ID");
      eventType = "step_failed";
      eventMsg = `Step ${step.step_number}: "${step.title}" gagal pada ${timeStr}${elapsed_str ? ` (elapsed: ${elapsed_str})` : ""}`;
      severity = "error";
    } else if (status === "in_progress") {
      eventType = "step_started";
      eventMsg = `Step ${step.step_number}: "${step.title}" dimulai`;
      severity = "info";
    } else if (status === "skipped") {
      eventType = "step_skipped";
      eventMsg = `Step ${step.step_number}: "${step.title}" di-skip`;
      severity = "warning";
    }

    if (eventType) {
      await pool.query(
        `INSERT INTO deployment_events (cr_id, event_type, message, severity, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [step.cr_id, eventType, eventMsg, severity, req.user.id],
      );
    }

    const io = req.app.get("io");

    // Recalculate CR-level progress based on steps
    const { rows: allSteps } = await pool.query(
      `SELECT status FROM deployment_steps WHERE cr_id = $1`,
      [step.cr_id],
    );
    const total = allSteps.length;
    const done = allSteps.filter((s) =>
      ["completed", "failed", "skipped"].includes(s.status),
    ).length;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (io) {
      io.to(`cr-${step.cr_id}`).emit("progress:updated", { progressPct, done, total });
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
  if (req.user.role === "approver")
    return res.status(403).json({ error: "Approver tidak dapat menambah event" });
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
