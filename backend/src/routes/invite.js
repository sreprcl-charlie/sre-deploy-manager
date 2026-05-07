const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────

function normalizeSquads(allowed_squads) {
  if (!Array.isArray(allowed_squads) || allowed_squads.length === 0)
    return ["core", "digital"];
  const valid = allowed_squads.filter((s) => ["core", "digital"].includes(s));
  if (valid.length === 0) return ["core", "digital"];
  return valid;
}

// ─────────────────────────────────────────────────────────────────────
// ADMIN: POST /api/invite — generate a new invite link
// Body: { allowed_squads: ["core"] | ["digital"] | ["core","digital"],
//         label?: string, expires_hours?: number }
// ─────────────────────────────────────────────────────────────────────
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const { label, expires_hours = 72 } = req.body;
  let { allowed_squads } = req.body;

  allowed_squads = normalizeSquads(allowed_squads);

  if (!Number.isInteger(expires_hours) || expires_hours < 1 || expires_hours > 8760) {
    return res.status(400).json({ error: "expires_hours must be between 1 and 8760" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000);

  try {
    const { rows } = await pool.query(
      `INSERT INTO invite_tokens (token, allowed_squads, label, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, token, allowed_squads, label, expires_at, created_at`,
      [token, allowed_squads, label || null, req.user.id, expiresAt],
    );

    const row = rows[0];
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.status(201).json({
      invite: row,
      url: `${baseUrl}/signup?token=${row.token}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/invite — list all invite tokens
// ─────────────────────────────────────────────────────────────────────
router.get("/", authMiddleware, requireRole("admin"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.token, i.allowed_squads, i.label,
              i.expires_at, i.is_revoked, i.created_at,
              cb.full_name AS created_by_name,
              ub.full_name AS used_by_name, i.used_at
       FROM invite_tokens i
       LEFT JOIN users cb ON cb.id = i.created_by
       LEFT JOIN users ub ON ub.id = i.used_by
       ORDER BY i.created_at DESC`,
    );
    res.json({ invites: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────
// ADMIN: DELETE /api/invite/:id — revoke an invite token
// ─────────────────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      `UPDATE invite_tokens SET is_revoked = TRUE WHERE id = $1 AND is_revoked = FALSE`,
      [id],
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Token not found or already revoked" });
    res.json({ message: "Token revoked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────
// PUBLIC: GET /api/invite/verify/:token — check token validity
// ─────────────────────────────────────────────────────────────────────
router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;
  // Validate token format (64 hex chars) to prevent injection
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: "Invalid token format" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, allowed_squads, label, expires_at, is_revoked, used_at
       FROM invite_tokens WHERE token = $1`,
      [token],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Token not found" });
    const inv = rows[0];
    if (inv.is_revoked) return res.status(410).json({ error: "Token has been revoked" });
    if (inv.used_at) return res.status(410).json({ error: "Token has already been used" });
    if (new Date(inv.expires_at) < new Date())
      return res.status(410).json({ error: "Token has expired" });
    res.json({ valid: true, allowed_squads: inv.allowed_squads, label: inv.label });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────
// PUBLIC: POST /api/invite/signup/:token — register new user via invite
// Body: { username, full_name, email, password, team (if allowed_squads > 1) }
// ─────────────────────────────────────────────────────────────────────
router.post("/signup/:token", async (req, res) => {
  const { token } = req.params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: "Invalid token format" });
  }

  const { username, full_name, email, password, team } = req.body;

  // Basic input validation
  if (!username || !full_name || !email || !password) {
    return res.status(400).json({ error: "username, full_name, email, password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-50 alphanumeric characters or underscores" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Re-check token under lock
    const { rows } = await client.query(
      `SELECT id, allowed_squads, expires_at, is_revoked, used_at
       FROM invite_tokens WHERE token = $1 FOR UPDATE`,
      [token],
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Token not found" });
    }
    const inv = rows[0];
    if (inv.is_revoked) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "Token has been revoked" });
    }
    if (inv.used_at) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "Token has already been used" });
    }
    if (new Date(inv.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "Token has expired" });
    }

    // Validate team against allowed_squads
    const allowed = inv.allowed_squads;
    let assignedTeam;
    if (allowed.length === 1) {
      assignedTeam = allowed[0];
    } else {
      // User must choose
      if (!team || !allowed.includes(team)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `team is required and must be one of: ${allowed.join(", ")}`,
        });
      }
      assignedTeam = team;
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (username, full_name, email, password, role, team)
       VALUES ($1,$2,$3,$4,'sre',$5)
       RETURNING id, username, full_name, email, role, team, created_at`,
      [username, full_name, email, hash, assignedTeam],
    );
    const newUser = userRows[0];

    // Mark token as used
    await client.query(
      `UPDATE invite_tokens SET used_by = $1, used_at = NOW() WHERE id = $2`,
      [newUser.id, inv.id],
    );

    await client.query("COMMIT");
    res.status(201).json({ user: newUser });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
