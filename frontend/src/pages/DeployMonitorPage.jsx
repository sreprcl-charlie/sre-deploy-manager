import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
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
} from "lucide-react";

const SEVERITY_COLORS = {
  info: "text-slate-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

// ── Countdown timer hook ─────────────────────────────────────────────────────
function useStepTimer(durationMin) {
  const totalSec = (durationMin || 0) * 60;
  const [remaining, setRemaining] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
  }, [running]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
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
function StepCard({ step, onAction, disabled }) {
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(null); // { status, label }
  const timer = useStepTimer(step.duration_min);

  const isActive = step.status === "in_progress";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";
  const isSkipped = step.status === "skipped";
  const isFinished = isDone || isFailed || isSkipped;

  // Auto-stop timer when step finishes
  useEffect(() => {
    if (isFinished) timer.stop();
  }, [isFinished]);

  const requestAction = (status, label) => setConfirm({ status, label });

  const doAction = () => {
    onAction(step.id, confirm.status, notes);
    if (confirm.status !== "in_progress") setNotes("");
    if (confirm.status === "in_progress") timer.start();
    if (confirm.status !== "in_progress") timer.stop();
    setConfirm(null);
  };

  const timerColor =
    timer.remaining === 0
      ? "text-red-400"
      : timer.pct >= 80
        ? "text-amber-400"
        : "text-emerald-400";

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
        className={`relative border rounded-xl p-4 transition-all ${
          isActive
            ? "border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-950/20"
            : isDone
              ? "border-emerald-700/30 bg-emerald-950/10"
              : isFailed
                ? "border-red-700/30 bg-red-950/10"
                : isSkipped
                  ? "border-slate-700/20 bg-slate-800/30 opacity-60"
                  : "border-slate-700/50 bg-slate-800/50"
        }`}
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-200">{step.title}</p>
              <StatusBadge status={step.status} />
            </div>
            {step.description && (
              <p className="text-sm text-slate-400 mt-0.5">
                {step.description}
              </p>
            )}

            {step.command && (
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

            {step.expected_result && (
              <p className="text-xs text-slate-500 mt-1.5">
                <span className="text-slate-600">Expected: </span>
                {step.expected_result}
              </p>
            )}

            {step.rollback_cmd && (
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
          </div>
        </div>

        {/* Actions */}
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
                  className="input text-sm resize-none"
                  rows={2}
                  placeholder="Catatan / hasil (opsional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      requestAction("completed", "Selesai / Success")
                    }
                    className="btn-success text-sm flex items-center gap-1.5 flex-1"
                  >
                    <CheckCircle size={13} /> Selesai
                  </button>
                  <button
                    onClick={() => requestAction("failed", "Gagal")}
                    className="btn-danger text-sm flex items-center gap-1.5 flex-1"
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
      </div>
    </>
  );
}

export default function DeployMonitorPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventMsg, setEventMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const eventsRef = useRef(null);
  const socketRef = useRef(null);

  const load = async () => {
    const res = await api.get(`/changes/${id}`);
    setData(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // Socket.io
    const token = localStorage.getItem("token");
    // Di production (Railway): VITE_WS_URL kosong → Socket.io auto-connect ke origin yang sama
    // Di development: fallback ke localhost:4000
    const wsUrl = import.meta.env.VITE_WS_URL || "http://localhost:4000";
    const socket = io(wsUrl || undefined, {
      auth: { token },
    });
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

    return () => {
      socket.emit("leave:cr", id);
      socket.disconnect();
    };
  }, [id]);

  const handleStepAction = async (stepId, status, notes) => {
    try {
      await api.patch(`/steps/${stepId}`, {
        status,
        notes: notes || undefined,
      });
      toast.success(`Step ${status}`);
    } catch {
      toast.error("Gagal update step");
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
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progressPct = steps.length
    ? Math.round((completedSteps / steps.length) * 100)
    : 0;
  const crReadonly =
    cr.status === "completed" ||
    cr.status === "completed_with_notes" ||
    cr.status === "rolled_back";

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
                  disabled={crReadonly}
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
              {/* Comment input */}
              <div className="flex gap-2 mt-3 shrink-0">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
