import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Shield, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client";

export default function SignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [tokenState, setTokenState] = useState("loading"); // loading | valid | invalid
  const [inviteInfo, setInviteInfo] = useState(null); // { allowed_squads, label }
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    team: "",
  });

  // Verify token on mount
  useEffect(() => {
    if (!token) { setTokenState("invalid"); return; }
    api.get(`/invite/verify/${token}`)
      .then((r) => {
        setInviteInfo(r.data);
        // Pre-select team if only one option
        if (r.data.allowed_squads.length === 1) {
          setForm((f) => ({ ...f, team: r.data.allowed_squads[0] }));
        }
        setTokenState("valid");
      })
      .catch(() => setTokenState("invalid"));
  }, [token]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/invite/signup/${token}`, form);
      toast.success("Akun berhasil dibuat! Silakan login.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal membuat akun");
    } finally {
      setLoading(false);
    }
  };

  // ── loading token check ──────────────────────────────────────────
  if (tokenState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020617" }}>
        <Loader2 size={28} className="animate-spin text-sky-400" />
      </div>
    );
  }

  // ── invalid token ────────────────────────────────────────────────
  if (tokenState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#020617" }}>
        <div
          className="max-w-sm w-full rounded-2xl p-8 text-center space-y-4"
          style={{
            background: "rgba(239,68,68,0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <XCircle size={40} className="text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-100">Link Tidak Valid</h2>
          <p className="text-sm text-slate-400">
            Link undangan ini sudah tidak berlaku, sudah digunakan, atau sudah kadaluarsa.
            Hubungi admin SRE untuk mendapatkan link baru.
          </p>
          <button onClick={() => navigate("/login")} className="btn-secondary text-sm w-full mt-2">
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  // ── valid — show signup form ─────────────────────────────────────
  const squads = inviteInfo?.allowed_squads || [];
  const needTeamChoice = squads.length > 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#020617" }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 space-y-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 40px rgba(56,189,248,0.06)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(56,189,248,0.15)",
              border: "1px solid rgba(56,189,248,0.25)",
              boxShadow: "0 0 16px rgba(56,189,248,0.2)",
            }}
          >
            <Shield size={18} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Buat Akun SRE</h1>
            <p className="text-xs text-slate-500">
              {inviteInfo?.label ? `Undangan: ${inviteInfo.label}` : "Link undangan valid"}
            </p>
          </div>
        </div>

        {/* Squad badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Squad:</span>
          {squads.map((s) => (
            <span
              key={s}
              className="text-xs font-semibold px-2. py-0.5 rounded-full capitalize"
              style={{
                background: s === "core" ? "rgba(56,189,248,0.1)" : "rgba(168,85,247,0.1)",
                border: `1px solid ${s === "core" ? "rgba(56,189,248,0.3)" : "rgba(168,85,247,0.3)"}`,
                color: s === "core" ? "#7dd3fc" : "#d8b4fe",
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input
              className="input"
              placeholder="Nama lengkap"
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username *</label>
              <input
                className="input"
                placeholder="sre_john"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                placeholder="john@company.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="input pr-10"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Team picker — only show if both squads are allowed */}
          {needTeamChoice && (
            <div>
              <label className="label">Pilih Squad *</label>
              <div className="flex gap-3">
                {squads.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField("team", s)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200"
                    style={
                      form.team === s
                        ? {
                            background: s === "core" ? "rgba(56,189,248,0.15)" : "rgba(168,85,247,0.15)",
                            border: `1px solid ${s === "core" ? "rgba(56,189,248,0.4)" : "rgba(168,85,247,0.4)"}`,
                            color: s === "core" ? "#7dd3fc" : "#d8b4fe",
                            boxShadow: `0 0 14px ${s === "core" ? "rgba(56,189,248,0.15)" : "rgba(168,85,247,0.15)"}`,
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#64748b",
                          }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (needTeamChoice && !form.team)}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Membuat akun...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle size={15} /> Buat Akun
              </span>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-600 text-center">
          Sudah punya akun?{" "}
          <button onClick={() => navigate("/login")} className="text-sky-400 hover:text-sky-300">
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
