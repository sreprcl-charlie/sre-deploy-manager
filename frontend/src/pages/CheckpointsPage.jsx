import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import toast from "react-hot-toast";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";

export default function CheckpointsPage() {
  const { user } = useAuth();
  const isApprover = user?.role === "approver";
  const [changes, setChanges] = useState([]);
  const [selectedCr, setSelectedCr] = useState("");
  const [checkpoints, setCheckpoints] = useState([]);
  const [loadingCr, setLoadingCr] = useState(true);
  const [notes, setNotes] = useState({});
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    api
      .get("/changes")
      .then((r) => {
        const active = r.data.changes.filter((c) =>
          ["approved", "in_progress"].includes(c.status),
        );
        setChanges(active);
        if (active.length > 0) setSelectedCr(String(active[0].id));
      })
      .finally(() => setLoadingCr(false));
  }, []);

  useEffect(() => {
    if (!selectedCr) return;
    api
      .get(`/checkpoints?cr_id=${selectedCr}`)
      .then((r) => setCheckpoints(r.data.checkpoints));
  }, [selectedCr]);

  const updateCheckpoint = async (id, status) => {
    setUpdating((u) => ({ ...u, [id]: true }));
    try {
      const res = await api.patch(`/checkpoints/${id}`, {
        status,
        notes: notes[id] || undefined,
      });
      setCheckpoints((cps) =>
        cps.map((c) => (c.id === id ? res.data.checkpoint : c)),
      );
      toast.success(`Checkpoint ${status}`);
    } catch {
      toast.error("Gagal update checkpoint");
    } finally {
      setUpdating((u) => ({ ...u, [id]: false }));
    }
  };

  const selectedChange = changes.find((c) => String(c.id) === selectedCr);
  const passed = checkpoints.filter((c) => c.status === "passed").length;
  const total = checkpoints.length;
  const progress = total ? Math.round((passed / total) * 100) : 0;

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Checkpoint Board</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Koordinasi pre-deployment dengan team lain sebelum mulai deploy
          </p>
        </div>

        {/* CR selector */}
        {loadingCr ? (
          <div className="h-10 w-64 bg-slate-800 rounded-lg animate-pulse" />
        ) : changes.length === 0 ? (
          <div className="card text-slate-500 text-sm">
            Tidak ada Change Request aktif dengan status approved / in_progress
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64 max-w-xs">
              <label className="label">Pilih Change Request</label>
              <select
                className="input"
                value={selectedCr}
                onChange={(e) => setSelectedCr(e.target.value)}
              >
                {changes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cr_number} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            {selectedChange && (
              <div className="flex items-center gap-3 pt-5">
                <StatusBadge status={selectedChange.status} />
                <span className="text-sm text-slate-500">
                  {selectedChange.environment?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {checkpoints.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                Progress Checkpoint
              </span>
              <span className="text-sm font-bold text-slate-200">
                {passed}/{total} Passed
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-sky-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <p className="text-emerald-400 text-sm font-semibold mt-2">
                ✓ Semua checkpoint sudah passed — siap deploy!
              </p>
            )}
          </div>
        )}

        {/* Checkpoint cards */}
        {checkpoints.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {checkpoints.map((cp) => (
              <div
                key={cp.id}
                className={`card border-l-4 ${
                  cp.status === "passed"
                    ? "border-l-emerald-500"
                    : cp.status === "failed"
                      ? "border-l-red-500"
                      : cp.status === "in_progress"
                        ? "border-l-amber-500"
                        : "border-l-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-200">
                        {cp.name}
                      </span>
                      <StatusBadge status={cp.status} />
                    </div>
                    <p className="text-xs text-sky-400 mt-0.5">{cp.team}</p>
                    {cp.description && (
                      <p className="text-sm text-slate-400 mt-1">
                        {cp.description}
                      </p>
                    )}
                    {cp.assigned_to_name && (
                      <p className="text-xs text-slate-500 mt-1">
                        Assigned: {cp.assigned_to_name}
                      </p>
                    )}
                    {cp.completed_by_name && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cp.status === "passed" ? "Passed" : "Updated"} by{" "}
                        {cp.completed_by_name}
                        {cp.completed_at &&
                          ` · ${new Date(cp.completed_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`}
                      </p>
                    )}
                    {cp.notes && (
                      <div className="mt-2 bg-slate-900/60 rounded px-2 py-1 text-xs text-slate-400 flex items-start gap-1.5">
                        <MessageSquare size={11} className="mt-0.5 shrink-0" />{" "}
                        {cp.notes}
                      </div>
                    )}
                  </div>
                </div>

                {cp.status !== "passed" && cp.status !== "failed" && !isApprover && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="input text-sm resize-none"
                      rows={2}
                      placeholder="Catatan (opsional)..."
                      value={notes[cp.id] || ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [cp.id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateCheckpoint(cp.id, "passed")}
                        disabled={updating[cp.id]}
                        className="btn-success flex items-center gap-1.5 text-sm flex-1"
                      >
                        <CheckCircle size={14} /> Passed
                      </button>
                      <button
                        onClick={() => updateCheckpoint(cp.id, "failed")}
                        disabled={updating[cp.id]}
                        className="btn-danger flex items-center gap-1.5 text-sm flex-1"
                      >
                        <XCircle size={14} /> Failed
                      </button>
                    </div>
                  </div>
                )}

                {(cp.status === "passed" || cp.status === "failed") && !isApprover && (
                  <button
                    onClick={() => updateCheckpoint(cp.id, "pending")}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Reset ke pending
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
