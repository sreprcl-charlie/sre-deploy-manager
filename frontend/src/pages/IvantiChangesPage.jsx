import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/client";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Loader2,
  Calendar,
  User,
  Users,
  Tag,
  Layers,
  ChevronDown,
  X,
  ExternalLink,
  Database,
  Wifi,
  WifiOff,
} from "lucide-react";

// ── Style constants ──────────────────────────────────────────────────────────

const GLASS = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
};

const GLASS_CARD = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
  transition: "all 0.2s ease",
};

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#cbd5e1",
  outline: "none",
  padding: "8px 12px",
  fontSize: "13px",
};

// ── Status config ────────────────────────────────────────────────────────────

function getStatusStyle(status = "") {
  const s = status.toLowerCase();
  if (s.includes("approved") || s.includes("implement"))
    return {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.25)",
      text: "#4ade80",
      glow: "rgba(34,197,94,0.15)",
      Icon: CheckCircle2,
    };
  if (s.includes("progress") || s.includes("review") || s.includes("active"))
    return {
      bg: "rgba(56,189,248,0.12)",
      border: "rgba(56,189,248,0.25)",
      text: "#38bdf8",
      glow: "rgba(56,189,248,0.15)",
      Icon: Loader2,
    };
  if (
    s.includes("submit") ||
    s.includes("pending") ||
    s.includes("draft") ||
    s.includes("new")
  )
    return {
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.25)",
      text: "#fbbf24",
      glow: "rgba(245,158,11,0.15)",
      Icon: Clock,
    };
  if (s.includes("complete") || s.includes("closed") || s.includes("done"))
    return {
      bg: "rgba(99,102,241,0.12)",
      border: "rgba(99,102,241,0.25)",
      text: "#a5b4fc",
      glow: "rgba(99,102,241,0.15)",
      Icon: CheckCircle2,
    };
  if (
    s.includes("reject") ||
    s.includes("cancel") ||
    s.includes("fail") ||
    s.includes("denied")
  )
    return {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.25)",
      text: "#f87171",
      glow: "rgba(239,68,68,0.15)",
      Icon: XCircle,
    };
  if (s.includes("hold") || s.includes("pause") || s.includes("defer"))
    return {
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.2)",
      text: "#f59e0b",
      glow: "rgba(245,158,11,0.1)",
      Icon: PauseCircle,
    };
  return {
    bg: "rgba(100,116,139,0.12)",
    border: "rgba(100,116,139,0.2)",
    text: "#94a3b8",
    glow: "transparent",
    Icon: AlertCircle,
  };
}

function getPriorityDot(priority = "") {
  const p = priority.toLowerCase();
  if (p === "critical") return "bg-red-500";
  if (p === "high") return "bg-orange-400";
  if (p === "medium") return "bg-amber-400";
  if (p === "low") return "bg-slate-500";
  return "bg-slate-600";
}

function StatusChip({ status }) {
  const st = getStatusStyle(status);
  const { Icon } = st;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
      style={{
        background: st.bg,
        border: `1px solid ${st.border}`,
        color: st.text,
        boxShadow: `0 0 10px ${st.glow}`,
      }}
    >
      <Icon size={11} />
      {status || "—"}
    </span>
  );
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(val) {
  if (!val) return "Never";
  const diff = Date.now() - new Date(val).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ change, onClose }) {
  if (!change) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 overflow-y-auto"
        style={{
          width: "min(520px, 100vw)",
          background: "rgba(2,6,23,0.97)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(32px)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-start justify-between p-5 gap-4"
          style={{
            background: "rgba(2,6,23,0.95)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-mono mb-1">
              {change.change_number || change.change_id}
            </p>
            <h2 className="text-slate-100 font-semibold text-base leading-snug">
              {change.subject || "Untitled"}
            </h2>
            <div className="mt-2">
              <StatusChip status={change.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Priority", value: change.priority, dot: true },
              { label: "Urgency", value: change.urgency },
              { label: "Type", value: change.change_type },
              { label: "Category", value: change.category },
              { label: "Service", value: change.service },
              { label: "Team", value: change.owner_team },
            ].map(({ label, value, dot }) =>
              value ? (
                <div
                  key={label}
                  className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[11px] text-slate-500 mb-1">{label}</p>
                  <div className="flex items-center gap-1.5">
                    {dot && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${getPriorityDot(value)}`}
                      />
                    )}
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {value}
                    </p>
                  </div>
                </div>
              ) : null,
            )}
          </div>

          {/* People */}
          <div className="space-y-2">
            {change.requested_by && (
              <div className="flex items-center gap-2.5">
                <User size={14} className="text-slate-500 shrink-0" />
                <span className="text-[12px] text-slate-500">Requested by</span>
                <span className="text-slate-300 text-[12px] font-medium">
                  {change.requested_by}
                </span>
              </div>
            )}
            {change.owner && (
              <div className="flex items-center gap-2.5">
                <Users size={14} className="text-slate-500 shrink-0" />
                <span className="text-[12px] text-slate-500">Owner</span>
                <span className="text-slate-300 text-[12px] font-medium">
                  {change.owner}
                </span>
              </div>
            )}
          </div>

          {/* Schedule */}
          {(change.scheduled_start || change.scheduled_end) && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.12)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} className="text-sky-400" />
                <span className="text-sky-400 text-xs font-medium">Schedule</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">Start</p>
                  <p className="text-slate-200 text-xs">
                    {formatDate(change.scheduled_start)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">End</p>
                  <p className="text-slate-200 text-xs">
                    {formatDate(change.scheduled_end)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {change.description && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Description</p>
              <div
                className="rounded-xl p-4 text-slate-300 text-sm leading-relaxed"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {change.description}
              </div>
            </div>
          )}

          {/* Reason */}
          {change.reason && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Reason for Change</p>
              <div
                className="rounded-xl p-4 text-slate-300 text-sm leading-relaxed"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {change.reason}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div
            className="rounded-xl p-3 grid grid-cols-2 gap-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div>
              <p className="text-[11px] text-slate-600">Created in Ivanti</p>
              <p className="text-slate-400 text-xs">
                {formatDateTime(change.created_at_ivanti)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-600">Last Synced</p>
              <p className="text-slate-400 text-xs">
                {formatDateTime(change.synced_at)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Change card ──────────────────────────────────────────────────────────────

function ChangeCard({ change, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(change)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer p-4 rounded-2xl"
      style={{
        ...GLASS_CARD,
        background: hovered
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.025)",
        borderColor: hovered
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.06)",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {change.priority && (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${getPriorityDot(change.priority)}`}
              />
            )}
            <span className="text-[11px] font-mono text-slate-500">
              {change.change_number || change.change_id?.slice(0, 12) + "…"}
            </span>
          </div>
          <h3 className="text-slate-100 text-sm font-medium leading-snug line-clamp-2">
            {change.subject || "Untitled"}
          </h3>
        </div>
        <div className="shrink-0">
          <StatusChip status={change.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
        {change.change_type && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Tag size={11} />
            {change.change_type}
          </span>
        )}
        {change.owner && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <User size={11} />
            {change.owner}
          </span>
        )}
        {change.owner_team && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Users size={11} />
            {change.owner_team}
          </span>
        )}
        {change.scheduled_start && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Calendar size={11} />
            {formatDate(change.scheduled_start)}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600 flex items-center gap-1">
          <ExternalLink size={10} />
          View detail
        </span>
      </div>
    </div>
  );
}

// ── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-7 pl-3 py-2 text-[12px] rounded-xl"
        style={{ ...INPUT_STYLE, paddingRight: "28px", cursor: "pointer" }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: "#0f172a" }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
      />
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ pagination, onPage }) {
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between mt-2">
      <p className="text-xs text-slate-500">
        {total === 0 ? "No data" : `${from}–${to} of ${total.toLocaleString()} changes`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronLeft size={14} />
          </button>

          {pages[0] > 1 && (
            <>
              <PageBtn n={1} active={false} onClick={() => onPage(1)} />
              {pages[0] > 2 && (
                <span className="text-slate-600 text-xs px-1">…</span>
              )}
            </>
          )}
          {pages.map((n) => (
            <PageBtn key={n} n={n} active={n === page} onClick={() => onPage(n)} />
          ))}
          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && (
                <span className="text-slate-600 text-xs px-1">…</span>
              )}
              <PageBtn n={totalPages} active={false} onClick={() => onPage(totalPages)} />
            </>
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function PageBtn({ n, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
      style={
        active
          ? {
              background: "rgba(56,189,248,0.15)",
              border: "1px solid rgba(56,189,248,0.3)",
              color: "#38bdf8",
            }
          : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid transparent",
              color: "#64748b",
            }
      }
    >
      {n}
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IvantiChangesPage() {
  const [changes, setChanges] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [meta, setMeta] = useState({ statuses: [], priorities: [], types: [] });
  const [syncStatus, setSyncStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await api.get("/ivanti/meta");
      setMeta(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await api.get("/ivanti/sync-status");
      setSyncStatus(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchChanges = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const params = {
          page: p,
          limit: 20,
          ...(search && { search }),
          ...(filterStatus && { status: filterStatus }),
          ...(filterPriority && { priority: filterPriority }),
          ...(filterType && { type: filterType }),
        };
        const res = await api.get("/ivanti/changes", { params });
        setChanges(res.data.changes);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [search, filterStatus, filterPriority, filterType],
  );

  // Initial load
  useEffect(() => {
    fetchMeta();
    fetchSyncStatus();
  }, [fetchMeta, fetchSyncStatus]);

  // Debounced search / filter changes
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchChanges(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, filterStatus, filterPriority, filterType, fetchChanges]);

  const handlePage = (p) => {
    setPage(p);
    fetchChanges(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.post("/ivanti/sync");
      // Poll sync status after a short wait
      setTimeout(async () => {
        await fetchSyncStatus();
        await fetchChanges(page);
        setSyncing(false);
      }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterType("");
  };

  const hasFilters = search || filterStatus || filterPriority || filterType;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  boxShadow: "0 0 16px rgba(99,102,241,0.15)",
                }}
              >
                <Layers size={14} className="text-indigo-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-100">
                Ivanti Changes
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Data change request dari Ivanti HEAT — auto-sync setiap 5 menit
            </p>
          </div>

          {/* Sync status + button */}
          <div className="flex items-center gap-3 shrink-0">
            {syncStatus && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{
                  background:
                    syncStatus.status === "error"
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(34,197,94,0.08)",
                  border: `1px solid ${syncStatus.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}`,
                  color: syncStatus.status === "error" ? "#f87171" : "#86efac",
                }}
              >
                {syncStatus.status === "error" ? (
                  <WifiOff size={12} />
                ) : (
                  <Wifi size={12} />
                )}
                <span>
                  {syncStatus.status === "error"
                    ? "Sync error"
                    : `${(syncStatus.totalInDb || 0).toLocaleString()} records`}
                </span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span style={{ opacity: 0.7 }}>
                  {timeAgo(syncStatus.lastSyncedAt)}
                </span>
              </div>
            )}
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
              }}
            >
              <RefreshCw
                size={13}
                className={syncing ? "animate-spin" : ""}
              />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div
          className="p-4 rounded-2xl space-y-3"
          style={GLASS}
        >
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-52">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nomor, judul, owner…"
                style={{
                  ...INPUT_STYLE,
                  paddingLeft: "34px",
                  width: "100%",
                }}
              />
            </div>

            <FilterSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={meta.statuses}
              placeholder="All Status"
            />
            <FilterSelect
              value={filterPriority}
              onChange={setFilterPriority}
              options={meta.priorities}
              placeholder="All Priority"
            />
            <FilterSelect
              value={filterType}
              onChange={setFilterType}
              options={meta.types}
              placeholder="All Type"
            />

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <Loader2 size={20} className="text-indigo-400 animate-spin" />
            </div>
            <p className="text-slate-500 text-sm">Loading changes…</p>
          </div>
        ) : changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(100,116,139,0.08)",
                border: "1px solid rgba(100,116,139,0.15)",
              }}
            >
              <Database size={22} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium mb-1">
                {hasFilters ? "Tidak ada hasil yang cocok" : "Belum ada data"}
              </p>
              <p className="text-slate-600 text-sm">
                {hasFilters
                  ? "Coba ubah filter pencarian"
                  : "Data akan muncul setelah sync dari Ivanti"}
              </p>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary text-xs">
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Change list */}
            <div className="space-y-2.5">
              {changes.map((c) => (
                <ChangeCard key={c.id} change={c} onClick={setSelected} />
              ))}
            </div>

            {/* Pagination */}
            <div
              className="p-4 rounded-2xl"
              style={GLASS}
            >
              <Pagination pagination={pagination} onPage={handlePage} />
            </div>
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer change={selected} onClose={() => setSelected(null)} />
      )}
    </Layout>
  );
}
