require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const { authMiddleware } = require("./middleware/auth");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const isProd = process.env.NODE_ENV === "production";

const corsOrigin = (origin, callback) => {
  // Di production: izinkan same-origin (origin null) dan FRONTEND_URL jika beda domain
  if (!origin) return callback(null, true);
  if (!isProd && /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
  const allowed = process.env.FRONTEND_URL;
  if (allowed && origin === allowed) return callback(null, true);
  // Same-origin request dari Railway (origin tidak dikirim)
  callback(null, true);
};
  if (allowed && origin === allowed) return callback(null, true);
  callback(new Error("CORS not allowed"));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// ── Middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());

// ── Static frontend (production) ────────────────────────────────────
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (isProd) {
  app.use(express.static(frontendDist));
}

// ── Routes ──────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/changes", require("./routes/changes"));
app.use("/api/checkpoints", require("./routes/checkpoints"));
app.use("/api/steps", require("./routes/steps"));
app.use("/api/pdf", require("./routes/pdf"));

// Health check
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date() }),
);

// SPA fallback — semua non-API route diarahkan ke index.html
if (isProd) {
  app.get("*", (_req, res) =>
    res.sendFile(path.join(frontendDist, "index.html")),
  );
} else {
  // 404 fallback dev
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
}

// ── Socket.io Auth + Rooms ───────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log(`[WS] Connected: ${socket.user?.username}`);

  // Client joins a CR room to receive live updates for that CR
  socket.on("join:cr", (cr_id) => {
    socket.join(`cr-${cr_id}`);
    console.log(`[WS] ${socket.user?.username} joined cr-${cr_id}`);
  });

  socket.on("leave:cr", (cr_id) => {
    socket.leave(`cr-${cr_id}`);
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Disconnected: ${socket.user?.username}`);
  });
});

// ── Start ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 SRE Deploy Manager API  →  http://localhost:${PORT}`);
  console.log(`   Env: ${process.env.NODE_ENV}`);
});
