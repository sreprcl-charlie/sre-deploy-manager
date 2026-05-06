const express = require("express");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/evidence?cr_id=X
router.get("/", async (req, res) => {
  const { cr_id } = req.query;
  if (!cr_id) return res.status(400).json({ error: "cr_id is required" });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.cr_id, e.filename, e.file_type, e.file_size_kb, e.data,
              e.uploaded_at, u.full_name AS uploaded_by_name
       FROM deployment_evidence e
       LEFT JOIN users u ON u.id = e.uploaded_by
       WHERE e.cr_id = $1
       ORDER BY e.uploaded_at ASC`,
      [cr_id],
    );
    res.json({ evidence: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/evidence  — upload one evidence file
router.post("/", async (req, res) => {
  if (req.user.role === "approver")
    return res.status(403).json({ error: "Approver tidak dapat upload evidence" });

  const { cr_id, filename, file_type, file_size_kb, data } = req.body;
  if (!cr_id || !filename || !file_type || !data)
    return res.status(400).json({ error: "cr_id, filename, file_type, data required" });

  // Validate it's an image
  if (!file_type.startsWith("image/"))
    return res.status(400).json({ error: "Hanya file gambar yang diizinkan" });

  // Guard: max 2MB per file (after compression, base64 encoded)
  const sizeKb = file_size_kb || Math.round((data.length * 3) / 4 / 1024);
  if (sizeKb > 2048)
    return res.status(400).json({ error: "Ukuran file maksimal 2MB per gambar" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO deployment_evidence (cr_id, filename, file_type, file_size_kb, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cr_id, filename, file_type, file_size_kb, data, uploaded_at`,
      [cr_id, filename, file_type, sizeKb, data, req.user.id],
    );

    // Notify other clients via socket
    const io = req.app.get("io");
    if (io) io.to(`cr-${cr_id}`).emit("evidence:new", { ...rows[0], uploaded_by_name: req.user.full_name });

    res.status(201).json({ evidence: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/evidence/:id
router.delete("/:id", async (req, res) => {
  if (req.user.role === "approver")
    return res.status(403).json({ error: "Akses tidak diizinkan" });
  try {
    const { rows } = await pool.query(
      "DELETE FROM deployment_evidence WHERE id = $1 AND uploaded_by = $2 RETURNING id",
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Tidak ditemukan atau bukan milik Anda" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
