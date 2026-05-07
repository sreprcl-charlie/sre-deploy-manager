import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/client";
import toast from "react-hot-toast";
import {
  Link2,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

const SQUAD_COLORS = {
  core: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.3)", text: "#7dd3fc" },
  digital: { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)", text: "#d8b4fe" },
};

function SquadBadge({ squad }) {
  const c = SQUAD_COLORS[squad] || SQUAD_COLORS.core;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {squad}
    </span>
  );
}

function statusOf(inv) {
  if (inv.is_revoked) return "revoked";
  if (inv.used_at) return "used";
  if (new Date(inv.expires_at) < new Date()) return "expired";
  return "active";
}

const STATUS_STYLE = {
  active:  { icon: CheckCircle, color: "#4ade80", label: "Active" },
  used:    { icon: CheckCircle, color: "#38bdf8", label: "Used" },
  expired: { icon: Clock,       color: "#94a3b8", label: "Expired" },
  revoked: { icon: XCircle,     color: "#f87171", label: "Revoked" },
};

const GLASS = {
  background: "rgba(255,255,255,0.03)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.07)",
};

export default function InvitePage() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    allowed_squads: ["core", "digital"],
    label: "",
    expires_hours: 72,
  });

  const load = () => {
    setLoading(true);
    api.get("/invite")
      .then((r) => setInvites(r.data.invites))
      .catch(() => toast.error("Gagal memuat invite links"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const baseUrl = window.location.origin;

  const toggleSquad = (squad) => {
    setForm((f) => {
      const has = f.allowed_squads.includes(squad);
      let next = has
        ? f.allowed_squads.filter((s) => s !== squad)
        : [...f.allowed_squads, squad];
      // Must have at least one
      if (next.length === 0) next = [squad];
      return { ...f, allowed_squads: next };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post("/invite", form);
      const url = res.data.url;
      setInvites((prev) => [res.data.invite, ...prev]);
      await navigator.clipboard.writeText(url);
      toast.success("Link dibuat & disalin ke clipboard!");
      setForm({ allowed_squads: ["core", "digital"], label: "", expires_hours: 72 });
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal membuat invite link");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm("Revoke invite link ini? Aksi tidak bisa dibatalkan.")) return;
    try {
      await api.delete(`/invite/${id}`);
      setInvites((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, is_revoked: true } : inv)),
      );
      toast.success("Token direvoke");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal merevoke token");
    }
  };

  const copyLink = async (token) => {
    const url = `${baseUrl}/signup?token=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link disalin!");
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.25)",
            }}
          >
            <Link2 size={16} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Invite Links</h1>
            <p className="text-sm text-slate-500">Generate link public untuk pendaftaran user baru</p>
          </div>
        </div>

        {/* Create form */}
        <form
          onSubmit={handleCreate}
          className="rounded-2xl p-5 space-y-4"
          style={GLASS}
        >
          <h2 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Plus size={14} className="text-sky-400" /> Buat Invite Link Baru
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Squad selector */}
            <div>
              <label className="label">Akses Squad *</label>
              <div className="flex gap-2 mt-1">
                {["core", "digital"].map((s) => {
                  const active = form.allowed_squads.includes(s);
                  const c = SQUAD_COLORS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSquad(s)}
                      className="flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all duration-200"
                      style={
                        active
                          ? { background: c.bg, border: `1px solid ${c.border}`, color: c.text }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Label */}
            <div className="sm:col-span-1">
              <label className="label">Label (opsional)</label>
              <input
                className="input"
                placeholder="Misal: Onboarding Batch Mei"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                maxLength={200}
              />
            </div>

            {/* Expiry */}
            <div>
              <label className="label">Berlaku (jam)</label>
              <select
                className="input"
                value={form.expires_hours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expires_hours: Number(e.target.value) }))
                }
              >
                <option value={24}>24 jam (1 hari)</option>
                <option value={72}>72 jam (3 hari)</option>
                <option value={168}>168 jam (7 hari)</option>
                <option value={336}>336 jam (14 hari)</option>
                <option value={720}>720 jam (30 hari)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Generate & Salin Link
            </button>
          </div>
        </form>

        {/* Token list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-300 text-sm">
              Semua Invite Links
              <span className="ml-2 text-slate-600 font-normal">({invites.length})</span>
            </h2>
            <button
              onClick={load}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : invites.length === 0 ? (
            <div
              className="rounded-2xl py-12 text-center text-slate-600"
              style={GLASS}
            >
              <Link2 size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada invite link dibuat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invites.map((inv) => {
                const st = statusOf(inv);
                const S = STATUS_STYLE[st];
                const isActive = st === "active";
                const url = `${baseUrl}/signup?token=${inv.token}`;

                return (
                  <div
                    key={inv.id}
                    className="rounded-xl p-4"
                    style={{
                      background: isActive
                        ? "rgba(56,189,248,0.04)"
                        : "rgba(255,255,255,0.02)",
                      border: isActive
                        ? "1px solid rgba(56,189,248,0.12)"
                        : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Status + squads */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <S.icon size={13} style={{ color: S.color }} />
                          <span className="text-xs font-semibold" style={{ color: S.color }}>
                            {S.label}
                          </span>
                          {inv.allowed_squads.map((s) => (
                            <SquadBadge key={s} squad={s} />
                          ))}
                          {inv.label && (
                            <span className="text-xs text-slate-500 italic">"{inv.label}"</span>
                          )}
                        </div>

                        {/* URL */}
                        {isActive && (
                          <p className="text-xs text-slate-400 font-mono truncate">
                            {url}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span>
                            Dibuat oleh {inv.created_by_name || "—"} ·{" "}
                            {new Date(inv.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          <span>
                            Exp:{" "}
                            {new Date(inv.expires_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          {inv.used_by_name && (
                            <span className="text-sky-600">
                              Dipakai:{" "}
                              {inv.used_by_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive && (
                          <button
                            onClick={() => copyLink(inv.token)}
                            className="btn-secondary flex items-center gap-1.5 text-xs"
                            title="Salin link"
                          >
                            <Copy size={12} /> Salin
                          </button>
                        )}
                        {isActive && (
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="btn-danger flex items-center gap-1.5 text-xs"
                            title="Revoke token"
                          >
                            <Trash2 size={12} /> Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
