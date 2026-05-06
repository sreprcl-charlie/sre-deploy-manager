import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import EvidenceUpload from "../components/EvidenceUpload";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  Play,
  Square,
  CheckCircle,
  XCircle,
  SkipForward,
  Download,
  Send,
  Clock,
  Terminal,
  AlertTriangle,
  RefreshCw,
  Timer,
  Edit2,
  MessageSquare,
} from "lucide-react";

const SEVERITY_COLORS = {
  info: "text-slate-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

// ── Countdown timer hook ─────────────────────────────────────────────────────
// startedAt: ISO string dari DB (atau null). Kalau ada dan timer belum manual-start,
// hitung remaining dari sana (resume on refresh).
function useStepTimer(durationMin, startedAt) {
  const totalSec = (durationMin || 0) * 60;

  const calcRemaining = () => {
    if (!startedAt) return totalSec;
    const elapsed = Math.floor((Date.now() - new Date(startedAt)) / 1000);
    return Math.max(totalSec - elapsed, 0);
  };

  const [remaining, setRemaining] = useState(calcRemaining);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  // True kalau user sudah manual-start di sesi ini — cegah overwrite dari DB update
  const manuallyStartedRef = useRef(false);

  // Auto-resume dari DB hanya saat mount/refresh (belum manual-start)
  useEffect(() => {
    if (startedAt && !manuallyStartedRef.current) {
      const r = calcRemaining();
      setRemaining(r);
      if (r > 0) {
        setRunning(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  const start = useCallback(() => {
    if (running) return;
    manuallyStartedRef.current = true;
    setRunning(true);
  }, [running]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    manuallyStartedRef.current = false;
    setRunning(false);
    setRemaining(totalSec);
  }, [totalSec]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            toast("⏰ Waktu step habis!", { icon: "⚠️" });
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const pct =
    totalSec > 0 ? Math.round(((totalSec - remaining) / totalSec) * 100) : 0;
  const overTime = remaining === 0 && running === false && pct === 100;

  const fmt = (s) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return { remaining, running, pct, overTime, fmt, start, stop, reset };
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-xl">
        <p className="text-slate-200 text-sm mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">
            Batal
          </button>
          <button onClick={onConfirm} className="btn-primary text-sm">
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ step, onAction, onAddAdjustment, onEditStep, onOverdue, disabled }) {
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(null); // { status, label }

  // Post-completion adjustment
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [adjustNote, setAdjustNote] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Content edit
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editFields, setEditFields] = useState({
    title: step.title || "",
    description: step.description || "",
    command: step.command || "",
    expected_result: step.expected_result || "",
    rollback_cmd: step.rollback_cmd || "",
    duration_min: step.duration_min || 5,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const overdueLoggedRef = useRef(false);

  const isActive = step.status === "in_progress";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";
  const isSkipped = step.status === "skipped";
  const isFinished = isDone || isFailed || isSkipped;

  const timer = useStepTimer(
    step.duration_min,
    isActive ? step.started_at : null,
  );

  // Overtime: countdown hit zero while step is still active
  const isOvertime = timer.remaining === 0 && timer.pct === 100 && isActive;

  // Sync edit fields every time the panel opens
  useEffect(() => {
    if (showEditPanel) {
      setEditFields({
        title: step.title || "",
        description: step.description || "",
        command: step.command || "",
        expected_result: step.expected_result || "",
        rollback_cmd: step.rollback_cmd || "",
        duration_min: step.duration_min || 5,
      });
    }
  }, [showEditPanel]);

  // Auto-log overdue event once when timer expires on an active step
  useEffect(() => {
    if (isOvertime && !overdueLoggedRef.current) {
      overdueLoggedRef.current = true;
      if (onOverdue) onOverdue(step.cr_id, step.step_number, step.title);
    }
  }, [isOvertime]);

  // Auto-stop timer when step finishes
  useEffect(() => {
    if (isFinished) timer.stop();
  }, [isFinished]);

  const requestAction = (status, label) => setConfirm({ status, label });

  const getElapsedStr = () => {
    if (!step.started_at) return "";
    const elapsed = Math.floor((Date.now() - new Date(step.started_at)) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}m ${s}s`;
  };

  const doAction = () => {
    const elapsedStr =
      confirm.status !== "in_progress" ? getElapsedStr() : undefined;
    onAction(step.id, confirm.status, notes, elapsedStr);
    if (confirm.status !== "in_progress") setNotes("");
    if (confirm.status === "in_progress") timer.start();
    else timer.stop();
    setConfirm(null);
  };

  const submitAdjustment = async () => {
    if (!adjustNote.trim()) return;
    setSavingAdjust(true);
    try {
      await onAddAdjustment(step.id, adjustNote.trim());
      setAdjustNote("");
      setShowAdjustPanel(false);
    } finally {
      setSavingAdjust(false);
    }
  };

  const submitEdit = async () => {
    if (!editReason.trim()) return;
    const changed = {};
    if (editFields.title !== (step.title || ""))
      changed.title = editFields.title;
    if (editFields.description !== (step.description || ""))
      changed.description = editFields.description;
    if (editFields.command !== (step.command || ""))
      changed.command = editFields.command;
    if (editFields.expected_result !== (step.expected_result || ""))
      changed.expected_result = editFields.expected_result;
    if (editFields.rollback_cmd !== (step.rollback_cmd || ""))
      changed.rollback_cmd = editFields.rollback_cmd;
    if (Number(editFields.duration_min) !== step.duration_min)
      changed.duration_min = Number(editFields.duration_min);

    if (Object.keys(changed).length === 0) {
      toast("Tidak ada perubahan yang disimpan");
      setShowEditPanel(false);
      return;
    }
    setSavingEdit(true);
    try {
      await onEditStep(step.id, changed, editReason.trim());
      setEditReason("");
      setShowEditPanel(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const timerColor =
    timer.remaining === 0
      ? "text-red-400"
      : timer.pct >= 80
        ? "text-amber-400"
        : "text-emerald-400";

  const borderClass = (() => {
    if (isActive)
      return "border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-950/20";
    if (isDone && step.is_adjusted)
      return "border-amber-500/40 bg-emerald-950/10";
    if (isDone) return "border-emerald-700/30 bg-emerald-950/10";
    if (isFailed) return "border-red-700/30 bg-red-950/10";
    if (isSkipped) return "border-slate-700/20 bg-slate-800/30 opacity-60";
    if (step.is_edited) return "border-indigo-700/40 bg-slate-800/50";
    return "border-slate-700/50 bg-slate-800/50";
  })();

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={`Yakin ingin menandai step ini sebagai "${confirm.label}"?`}
          onConfirm={doAction}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div
        className={`relative border rounded-xl p-4 transition-all ${borderClass}`}
      >
        {/* Step number + title */}
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              isDone
                ? "border-emerald-500 text-emerald-400 bg-emerald-950"
                : isFailed
                  ? "border-red-500 text-red-400 bg-red-950"
                  : isActive
                    ? "border-amber-400 text-amber-300 bg-amber-950 animate-pulse"
                    : "border-slate-600 text-slate-500 bg-slate-800"
            }`}
          >
            {isDone ? "✓" : isFailed ? "✗" : step.step_number}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-200">{step.title}</p>
              <StatusBadge status={step.status} />
              {step.is_adjusted && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 border border-amber-700/40 font-medium">
                  Adjusted
                </span>
              )}
              {step.is_edited && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-700/40 font-medium">
                  Edited
                </span>
              )}
              {!disabled && !showEditPanel && (
                <button
                  onClick={() => setShowEditPanel(true)}
                  className="ml-auto text-slate-600 hover:text-indigo-400 transition-colors p-0.5"
                  title="Edit isi step"
                >
                  <Edit2 size={13} />
                </button>
              )}
            </div>

            {/* Edit reason info */}
            {step.is_edited && step.edit_reason && (
              <div className="mt-0.5 text-xs text-indigo-400/70 flex items-center gap-1">
                <Edit2 size={10} /> Alasan edit: {step.edit_reason}
              </div>
            )}

            {/* ── Edit panel ── */}
            {showEditPanel && (
              <div className="mt-3 space-y-2 bg-slate-900/60 rounded-lg p-3 border border-indigo-700/30">
                <p className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                  <Edit2 size={11} /> Edit Isi Step
                  <span className="text-slate-600 font-normal ml-1">
                    (akan di-flag sebagai Edited)
                  </span>
                </p>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Nama Step
                  </label>
                  <input
                    className="input text-sm w-full"
                    value={editFields.title}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Deskripsi
                  </label>
                  <textarea
                    className="input text-sm resize-none w-full"
                    rows={2}
                    value={editFields.description}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Command
                  </label>
                  <input
                    className="input text-sm font-mono w-full"
                    value={editFields.command}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, command: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Expected Result
                  </label>
                  <input
                    className="input text-sm w-full"
                    value={editFields.expected_result}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        expected_result: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Rollback Command
                  </label>
                  <input
                    className="input text-sm font-mono w-full"
                    value={editFields.rollback_cmd}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        rollback_cmd: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-0.5 block">
                    Durasi (menit)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input text-sm w-24"
                    value={editFields.duration_min}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        duration_min: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-red-400 mb-0.5 block font-medium">
                    * Alasan perubahan (wajib)
                  </label>
                  <input
                    className="input text-sm w-full"
                    placeholder="Kenapa isi step ini perlu diubah?"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={submitEdit}
                    disabled={!editReason.trim() || savingEdit}
                    className="btn-primary text-xs flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditPanel(false);
                      setEditReason("");
                    }}
                    className="btn-secondary text-xs"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {!showEditPanel && step.description && (
              <p className="text-sm text-slate-400 mt-0.5">
                {step.description}
              </p>
            )}

            {!showEditPanel && step.command && (
              <div className="mt-2 flex items-start gap-2 bg-slate-950 rounded-lg px-3 py-2">
                <Terminal
                  size={13}
                  className="text-slate-500 mt-0.5 shrink-0"
                />
                <code className="text-xs text-sky-300 font-mono break-all">
                  {step.command}
                </code>
              </div>
            )}

            {!showEditPanel && step.expected_result && (
              <p className="text-xs text-slate-500 mt-1.5">
                <span className="text-slate-600">Expected: </span>
                {step.expected_result}
              </p>
            )}

            {!showEditPanel && step.rollback_cmd && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                <RefreshCw size={10} />
                <span className="font-mono">{step.rollback_cmd}</span>
              </div>
            )}

            {(step.started_at || step.completed_at) && (
              <div className="flex gap-4 text-xs text-slate-600 mt-1.5">
                {step.started_at && (
                  <span>
                    Started:{" "}
                    {new Date(step.started_at).toLocaleTimeString("id-ID")}
                  </span>
                )}
                {step.completed_at && (
                  <span>
                    Done:{" "}
                    {new Date(step.completed_at).toLocaleTimeString("id-ID")}
                  </span>
                )}
                {step.executed_by_name && (
                  <span>by {step.executed_by_name}</span>
                )}
              </div>
            )}

            {step.notes && (
              <div className="mt-2 bg-amber-950/30 border border-amber-800/30 rounded px-2 py-1 text-xs text-amber-400">
                📝 {step.notes}
              </div>
            )}

            {/* ── Timer ── */}
            {step.duration_min > 0 && !isFinished && (
              <div className="mt-3 flex items-center gap-3">
                {/* Progress bar */}
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      timer.remaining === 0
                        ? "bg-red-500"
                        : timer.pct >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${timer.pct}%` }}
                  />
                </div>
                {/* Time display */}
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${timerColor}`}
                >
                  {timer.fmt(timer.remaining)}
                </span>
                <span className="text-xs text-slate-600">
                  / {step.duration_min}m
                </span>
                {/* Start / Stop / Reset buttons */}
                {!timer.running ? (
                  <button
                    onClick={() => {
                      if (step.status === "pending") {
                        toast.error(
                          "Mulai step terlebih dahulu sebelum menjalankan timer",
                        );
                        return;
                      }
                      if (timer.remaining === 0) {
                        timer.reset();
                        setTimeout(() => timer.start(), 50);
                      } else {
                        timer.start();
                      }
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    title="Mulai timer"
                  >
                    <Timer size={11} /> Start
                  </button>
                ) : (
                  <button
                    onClick={timer.stop}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 transition-colors"
                    title="Pause timer"
                  >
                    <Square size={11} /> Stop
                  </button>
                )}
              </div>
            )}

            {/* Overtime warning */}
            {isOvertime && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-700/30 rounded px-2 py-1.5">
                <AlertTriangle size={12} />
                Waktu habis! Wajib isi catatan sebelum melanjutkan.
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        {!isFinished && !disabled && (
          <div className="mt-3 ml-11">
            {step.status === "pending" && (
              <button
                onClick={() => requestAction("in_progress", "Mulai")}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Play size={13} /> Mulai Step
              </button>
            )}
            {step.status === "in_progress" && (
              <div className="space-y-2">
                <textarea
                  className={`input text-sm resize-none ${isOvertime ? "border-red-500/50 focus:border-red-500" : ""}`}
                  rows={2}
                  placeholder={
                    isOvertime
                      ? "Wajib isi: alasan overtime / apa yang terjadi..."
                      : "Catatan / hasil (opsional)..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                {isOvertime && !notes.trim() && (
                  <p className="text-xs text-red-400">
                    * Catatan wajib diisi karena melebihi waktu rundown
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => requestAction("completed", "Finish")}
                    disabled={isOvertime && !notes.trim()}
                    className="btn-success text-sm flex items-center gap-1.5 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle size={13} /> Finish
                  </button>
                  <button
                    onClick={() => requestAction("failed", "Gagal")}
                    disabled={isOvertime && !notes.trim()}
                    className="btn-danger text-sm flex items-center gap-1.5 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XCircle size={13} /> Gagal
                  </button>
                  <button
                    onClick={() => requestAction("skipped", "Skip")}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                    title="Skip step"
                  >
                    <SkipForward size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Post-completion adjustment ── */}
        {isFinished && !disabled && (
          <div className="mt-2 ml-11">
            {!showAdjustPanel ? (
              <button
                onClick={() => setShowAdjustPanel(true)}
                className="text-xs flex items-center gap-1 text-slate-600 hover:text-amber-400 transition-colors"
              >
                <MessageSquare size={11} /> Tambah Catatan Adjustment
              </button>
            ) : (
              <div className="space-y-2 bg-amber-950/20 rounded-lg p-3 border border-amber-800/30">
                <p className="text-xs text-amber-400 font-medium">
                  Catatan Adjustment
                </p>
                <textarea
                  className="input text-sm resize-none"
                  rows={2}
                  placeholder="Apa yang perlu dicatat sebagai adjustment?"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={submitAdjustment}
                    disabled={!adjustNote.trim() || savingAdjust}
                    className="btn-primary text-xs flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingAdjust ? "Menyimpan..." : "Simpan"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAdjustPanel(false);
                      setAdjustNote("");
                    }}
                    className="btn-secondary text-xs"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function DeployMonitorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isApprover = user?.role === "approver";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventMsg, setEventMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const eventsRef = useRef(null);
  const socketRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get(`/changes/${id}`);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Socket.io
    const token = localStorage.getItem("token");
    // Di production (Railway): VITE_WS_URL="" → auto-connect ke origin yang sama (no URL arg)
    // Di development: VITE_WS_URL="http://localhost:4000"
    const wsUrl = import.meta.env.VITE_WS_URL;
    const socket = wsUrl
      ? io(wsUrl, { auth: { token } })
      : io({ auth: { token } });
    socketRef.current = socket;

    socket.emit("join:cr", id);

    socket.on("step:updated", (step) => {
      setData((d) =>
        d
          ? {
              ...d,
              steps: d.steps.map((s) =>
                s.id === step.id ? { ...s, ...step } : s,
              ),
            }
          : d,
      );
    });

    socket.on("checkpoint:updated", (cp) => {
      setData((d) =>
        d
          ? {
              ...d,
              checkpoints: d.checkpoints.map((c) =>
                c.id === cp.id ? { ...c, ...cp } : c,
              ),
            }
          : d,
      );
    });

    socket.on("event:new", (ev) => {
      setData((d) => (d ? { ...d, events: [ev, ...d.events] } : d));
      if (eventsRef.current) {
        eventsRef.current.scrollTop = 0;
      }
    });

    // evidence:new is handled inside EvidenceUpload via its own state + API

    return () => {
      socket.emit("leave:cr", id);
      socket.disconnect();
    };
  }, [id]);

  const handleStepAction = async (stepId, status, notes, elapsedStr) => {
    try {
      const res = await api.patch(`/steps/${stepId}`, {
        status,
        notes: notes || undefined,
        elapsed_str: elapsedStr || undefined,
      });
      // Update local state immediately (socket update is secondary)
      setData((d) =>
        d
          ? {
              ...d,
              steps: d.steps.map((s) =>
                s.id === stepId ? { ...s, ...res.data.step } : s,
              ),
            }
          : d,
      );
      toast.success(`Step ${status}`);
    } catch {
      toast.error("Gagal update step");
    }
  };

  const handleAddAdjustment = async (stepId, note) => {
    try {
      const res = await api.patch(`/steps/${stepId}`, {
        notes: note,
        is_adjustment: true,
      });
      setData((d) =>
        d
          ? {
              ...d,
              steps: d.steps.map((s) =>
                s.id === stepId ? { ...s, ...res.data.step } : s,
              ),
            }
          : d,
      );
      toast.success("Catatan adjustment disimpan");
    } catch {
      toast.error("Gagal simpan catatan");
    }
  };

  const handleEditStep = async (stepId, fields, editReason) => {
    try {
      const res = await api.patch(`/steps/${stepId}`, {
        ...fields,
        edit_reason: editReason,
      });
      // Update local state immediately so is_edited flag shows without waiting for socket
      setData((d) =>
        d
          ? {
              ...d,
              steps: d.steps.map((s) =>
                s.id === stepId ? { ...s, ...res.data.step } : s,
              ),
            }
          : d,
      );
      toast.success("Step berhasil diubah");
    } catch {
      toast.error("Gagal ubah step");
    }
  };

  const handleStepOverdue = async (crId, stepNumber, stepTitle) => {
    try {
      await api.post(`/steps/cr/${crId}/event`, {
        message: `⚠️ Step ${stepNumber}: "${stepTitle}" melebihi waktu rundown (overdue)`,
        event_type: "step_overdue",
        severity: "warning",
      });
    } catch {
      // Overdue log gagal tidak perlu toast, jangan ganggu user
    }
  };

  const sendEvent = async () => {
    if (!eventMsg.trim()) return;
    setSending(true);
    try {
      await api.post(`/steps/cr/${id}/event`, {
        message: eventMsg,
        event_type: "comment",
      });
      setEventMsg("");
    } catch {
      toast.error("Gagal kirim log");
    } finally {
      setSending(false);
    }
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const res = await api.get(`/pdf/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deployment-report-${data?.change?.cr_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error("Gagal generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <div className="p-6 text-red-400">CR tidak ditemukan</div>
      </Layout>
    );

  const { change: cr, checkpoints, steps, events } = data;
  const completedSteps = steps.filter((s) =>
    ["completed", "failed", "skipped"].includes(s.status),
  ).length;
  const progressPct = steps.length
    ? Math.round((completedSteps / steps.length) * 100)
    : 0;
  const crReadonly =
    cr.status === "completed" ||
    cr.status === "completed_with_notes" ||
    cr.status === "rolled_back";

  const allStepsDone =
    steps.length > 0 &&
    steps.every((s) =>
      ["completed", "failed", "skipped"].includes(s.status),
    );

  return (
    <Layout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              to={`/changes/${id}`}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-1"
            >
              <ChevronLeft size={14} /> {cr.cr_number}
            </Link>
            <h1 className="text-xl font-bold text-slate-100">{cr.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={cr.status} />
              <span className="text-xs text-slate-500 uppercase bg-slate-800 px-2 py-0.5 rounded">
                {cr.environment}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(cr.scheduled_start).toLocaleString("id-ID", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {" → "}
                {new Date(cr.scheduled_end).toLocaleString("id-ID", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={downloadPDF}
            disabled={pdfLoading}
            className="btn-secondary flex items-center gap-2 shrink-0"
          >
            <Download size={14} /> {pdfLoading ? "Generating..." : "PDF Report"}
          </button>
        </div>

        {/* Progress bar */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">
              Progress Deployment
            </span>
            <span className="text-sm font-bold text-slate-200">
              {completedSteps}/{steps.length} Steps
            </span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progressPct === 100
                  ? "bg-emerald-500"
                  : crReadonly && cr.status === "rolled_back"
                    ? "bg-orange-500"
                    : "bg-sky-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progressPct === 100 && cr.status !== "completed" && (
            <p className="text-emerald-400 text-sm mt-1.5">
              Semua step selesai! Jangan lupa update status CR.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left: Steps */}
          <div className="col-span-2 space-y-3">
            <h2 className="font-semibold text-slate-300">
              Deployment Steps
              {crReadonly && (
                <span className="ml-2 text-xs text-slate-600">(read-only)</span>
              )}
            </h2>
            {steps.length === 0 ? (
              <div className="card text-slate-500 text-sm">
                Belum ada runbook steps
              </div>
            ) : (
              steps.map((s) => (
                <StepCard
                  key={s.id}
                  step={s}
                  onAction={handleStepAction}
                  onAddAdjustment={handleAddAdjustment}
                  onEditStep={handleEditStep}
                  onOverdue={handleStepOverdue}
                  disabled={crReadonly || isApprover}
                />
              ))
            )}
          </div>

          {/* Right: Checkpoints + Event log */}
          <div className="space-y-4">
            {/* Checkpoints mini */}
            <div className="card">
              <h2 className="font-semibold text-slate-300 text-sm mb-3">
                Checkpoints (
                {checkpoints.filter((c) => c.status === "passed").length}/
                {checkpoints.length})
              </h2>
              {checkpoints.length === 0 ? (
                <p className="text-slate-600 text-xs">Tidak ada checkpoint</p>
              ) : (
                <div className="space-y-1.5">
                  {checkpoints.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                          cp.status === "passed"
                            ? "border-emerald-500 text-emerald-400 bg-emerald-950"
                            : cp.status === "failed"
                              ? "border-red-500 text-red-400 bg-red-950"
                              : "border-slate-600 bg-slate-800 text-slate-600"
                        }`}
                      >
                        {cp.status === "passed"
                          ? "✓"
                          : cp.status === "failed"
                            ? "✗"
                            : "○"}
                      </span>
                      <span className="truncate text-slate-300">{cp.name}</span>
                      <span className="text-xs text-slate-600 shrink-0">
                        {cp.team}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event log */}
            <div
              className="card flex flex-col"
              style={{ minHeight: "300px", maxHeight: "420px" }}
            >
              <h2 className="font-semibold text-slate-300 text-sm mb-3 shrink-0">
                Event Log
              </h2>
              <div
                ref={eventsRef}
                className="flex-1 overflow-y-auto space-y-1 font-mono text-xs"
              >
                {events.length === 0 ? (
                  <p className="text-slate-600">Belum ada event</p>
                ) : (
                  events.map((ev) => (
                    <div
                      key={ev.id}
                      className={`${SEVERITY_COLORS[ev.severity] || "text-slate-400"}`}
                    >
                      <span className="text-slate-600">
                        [{new Date(ev.created_at).toLocaleTimeString("id-ID")}]
                      </span>{" "}
                      <span className="text-slate-500">
                        {ev.user_name || "system"}:
                      </span>{" "}
                      {ev.message}
                    </div>
                  ))
                )}
              </div>
              {/* Comment input — hidden for approver */}
              {!isApprover && <div className="flex gap-2 mt-3 shrink-0">
                <input
                  className="input text-sm flex-1"
                  placeholder="Tulis log / komentar..."
                  value={eventMsg}
                  onChange={(e) => setEventMsg(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendEvent()
                  }
                />
                <button
                  onClick={sendEvent}
                  disabled={sending || !eventMsg.trim()}
                  className="btn-primary p-2"
                >
                  <Send size={14} />
                </button>
              </div>}
            </div>
          </div>
        </div>

        {/* Evidence upload — visible when all steps done */}
        {allStepsDone && (
          <EvidenceUpload crId={id} readOnly={isApprover} />
        )}
      </div>
    </Layout>
  );
}
