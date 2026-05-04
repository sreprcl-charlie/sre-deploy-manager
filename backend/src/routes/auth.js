const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, full_name, email, password, role = "sre", team } = req.body;
  if (!username || !full_name || !email || !password) {
    return res
      .status(400)
      .json({ error: "username, full_name, email, password are required" });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (username, full_name, email, password, role, team)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, full_name, email, role, team, created_at`,
      [username, full_name, email, hash, role, team],
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        team: user.team,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        team: user.team,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get(
  "/me",
  require("../middleware/auth").authMiddleware,
  async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, role, team, created_at FROM users WHERE id = $1",
      [req.user.id],
    );
    res.json({ user: rows[0] });
  },
);

// GET /api/auth/users  (list all users — for assignment dropdowns)
router.get(
  "/users",
  require("../middleware/auth").authMiddleware,
  async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, username, full_name, email, role, team FROM users ORDER BY full_name",
    );
    res.json({ users: rows });
  },
);

module.exports = router;
