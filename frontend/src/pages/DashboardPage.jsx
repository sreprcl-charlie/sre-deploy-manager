import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  FileText,
  CheckCircle,
  Activity,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Zap,
  RotateCcw,
} from "lucide-react";

const ACCENTS = {
  sky: {
    icon: "text-sky-400",
    iconBg: "rgba(56,189,248,0.1)",
    iconBorder: "rgba(56,189,248,0.2)",
    cardBg: "rgba(56,189,248,0.04)",
    cardBorder: "rgba(56,189,248,0.14)",
    glow: "0 0 24px rgba(56,189,248,0.12)",
    bar: "#38bdf8",
    value: "#38bdf8",
    valueShadow: "0 0 24px rgba(56,189,248,0.4)",
  },
  yellow: {
    icon: "text-amber-400",
    iconBg: "rgba(245,158,11,0.1)",
    iconBorder: "rgba(245,158,11,0.2)",
    cardBg: "rgba(245,158,11,0.04)",
    cardBorder: "rgba(245,158,11,0.14)",
    glow: "0 0 24px rgba(245,158,11,0.1)",
    bar: "#f59e0b",
    value: "#f59e0b",
    valueShadow: "0 0 24px rgba(245,158,11,0.35)",
  },
  green: {
    icon: "text-emerald-400",
    iconBg: "rgba(34,197,94,0.1)",
    iconBorder: "rgba(34,197,94,0.2)",
    cardBg: "rgba(34,197,94,0.04)",
    cardBorder: "rgba(34,197,94,0.14)",
    glow: "0 0 24px rgba(34,197,94,0.12)",
    bar: "#22c55e",
    value: "#22c55e",
    valueShadow: "0 0 24px rgba(34,197,94,0.4)",
  },
  teal: {
    icon: "text-teal-400",
    iconBg: "rgba(20,184,166,0.1)",
    iconBorder: "rgba(20,184,166,0.2)",
    cardBg: "rgba(20,184,166,0.04)",
    cardBorder: "rgba(20,184,166,0.14)",
    glow: "0 0 24px rgba(20,184,166,0.12)",
    bar: "#14b8a6",
    value: "#14b8a6",
    valueShadow: "0 0 24px rgba(20,184,166,0.35)",
  },
  red: {
    icon: "text-red-400",
    iconBg: "rgba(239,68,68,0.1)",
    iconBorder: "rgba(239,68,68,0.2)",
    cardBg: "rgba(239,68,68,0.04)",
    cardBorder: "rgba(239,68,68,0.14)",
    glow: "0 0 24px rgba(239,68,68,0.1)",
    bar: "#ef4444",
    value: "#ef4444",
    valueShadow: "0 0 24px rgba(239,68,68,0.3)",
  },
};

function StatCard({ label, value, icon: Icon, accent = "sky", live = false }) {
  const a = ACCENTS[accent];
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: a.cardBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${a.cardBorder}`,
        boxShadow: a.glow,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${a.bar}, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
            {label}
          </p>
          <p
            className="text-3xl font-bold tabular-nums font-mono"
            style={{ color: a.value, textShadow: a.valueShadow }}
          >
            {value ?? "—"}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: a.iconBg,
            border: `1px solid ${a.iconBorder}`,
          }}
        >
          <Icon size={17} className={a.icon} />
        </div>
      </div>

      {live && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      )}
    </div>
  );
}

function priorityColor(p) {
  return p === "critical"
    ? "text-red-400"
    : p === "high"
      ? "text-orange-400"
      : p === "medium"
        ? "text-amber-400"
        : "text-slate-500";
}

const GLASS_PANEL = {
  background: "rgba(255,255,255,0.03)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.07)",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/changes")
      .then((r) => setChanges(r.data.changes))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: changes.length,
    approved: changes.filter((c) => c.status === "approved").length,
    inProgress: changes.filter((c) => c.status === "in_progress").length,
    success: changes.filter(
      (c) => c.status === "completed" || c.status === "completed_with_notes",
    ).length,
    rollback: changes.filter((c) => c.status === "rolled_back").length,
  };

  const upcoming = changes
    .filter((c) => ["approved", "in_progress"].includes(c.status))
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
    .slice(0, 5);

  const recent = changes
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8);

  const successRate =
    stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null;

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-slate-500 text-sm">{greeting},</p>
            <h1 className="text-2xl font-bold text-slate-100 mt-0.5">
              {user?.full_name}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {now.toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {!loading && successRate !== null && (
            <div
              className="text-center px-6 py-4 rounded-2xl shrink-0"
              style={{
                background: "rgba(34,197,94,0.06)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(34,197,94,0.18)",
                boxShadow: "0 0 28px rgba(34,197,94,0.1)",
              }}
            >
              <p
                className="text-3xl font-bold font-mono"
                style={{ color: "#22c55e", textShadow: "0 0 24px rgba(34,197,94,0.5)" }}
              >
                {successRate}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Success Rate</p>
            </div>
          )}
        </div>

        {/* ── Stat Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="Total CR" value={stats.total} icon={FileText} accent="sky" />
          <StatCard label="Menunggu Deploy" value={stats.approved} icon={Clock} accent="yellow" />
          <StatCard
            label="Sedang Berjalan"
            value={stats.inProgress}
            icon={Zap}
            accent="green"
            live={stats.inProgress > 0}
          />
          <StatCard label="Success" value={stats.success} icon={CheckCircle} accent="teal" />
          <StatCard label="Rollback" value={stats.rollback} icon={RotateCcw} accent="red" />
        </div>

        {/* ── Main Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Upcoming deployments */}
          <div className="rounded-2xl p-5" style={GLASS_PANEL}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
                <TrendingUp size={14} className="text-sky-400" />
                Jadwal Deploy
              </h2>
              <Link
                to="/changes"
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors duration-200"
              >
                Lihat semua <ArrowRight size={11} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl animate-pulse"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-700">
                <CheckCircle size={28} className="mb-2" />
                <p className="text-sm">Tidak ada jadwal deployment aktif</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map((c) => (
                  <Link
                    key={c.id}
                    to={`/deploy/${c.id}`}
                    className="group flex items-start gap-3 p-3 rounded-xl transition-all duration-200"
                    style={{ border: "1px solid transparent" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "transparent";
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-sky-400">{c.cmf_number}</span>
                        <span
                          className={`text-xs font-semibold uppercase ${priorityColor(c.priority)}`}
                        >
                          {c.priority}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded uppercase font-mono text-slate-500"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          {c.environment}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 truncate">{c.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(c.scheduled_start).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl p-5" style={GLASS_PANEL}>
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2 text-sm">
              <Activity size={14} className="text-sky-400" />
              Aktivitas Terbaru
            </h2>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl animate-pulse"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    to={`/changes/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <StatusBadge status={c.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{c.title}</p>
                      <p className="text-xs text-slate-600">
                        <span className="font-mono">{c.cmf_number}</span> ·{" "}
                        {c.environment?.toUpperCase()}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 shrink-0">
                      {new Date(c.updated_at).toLocaleDateString("id-ID")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

