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
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color = "sky" }) {
  const colors = {
    sky: "text-sky-400 bg-sky-400/10",
    green: "text-emerald-400 bg-emerald-400/10",
    yellow: "text-amber-400 bg-amber-400/10",
    red: "text-red-400 bg-red-400/10",
  };
  return (
    <div className="card flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value ?? "—"}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
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
        : "text-slate-400";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/changes")
      .then((r) => {
        setChanges(r.data.changes);
      })
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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Halo, {user?.full_name} ·{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            label="Total Change Request"
            value={stats.total}
            icon={FileText}
            color="sky"
          />
          <StatCard
            label="Menunggu Deploy"
            value={stats.approved}
            icon={Clock}
            color="yellow"
          />
          <StatCard
            label="Sedang Berjalan"
            value={stats.inProgress}
            icon={Activity}
            color="green"
          />
          <StatCard
            label="Success"
            value={stats.success}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            label="Rollback"
            value={stats.rollback}
            icon={AlertTriangle}
            color="red"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Upcoming deployments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                <TrendingUp size={16} className="text-sky-400" /> Jadwal Deploy
              </h2>
              <Link
                to="/changes"
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 bg-slate-700/50 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Tidak ada jadwal deployment aktif
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((c) => (
                  <Link
                    key={c.id}
                    to={`/deploy/${c.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 hover:bg-slate-700/50 transition-colors border border-slate-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-sky-400">
                          {c.cr_number}
                        </span>
                        <span
                          className={`text-xs font-semibold uppercase ${priorityColor(c.priority)}`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 truncate mt-0.5">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(c.scheduled_start).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        · {c.environment?.toUpperCase()}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-sky-400" /> Aktivitas Terbaru
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-slate-700/50 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    to={`/changes/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <StatusBadge status={c.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-600">
                        {c.cr_number} · {c.environment?.toUpperCase()}
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
