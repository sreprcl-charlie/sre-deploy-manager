import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import SignatureCanvas from "../components/SignatureCanvas";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import toast from "react-hot-toast";
import {
  Download,
  Play,
  ChevronLeft,
  Clock,
  Server,
  User,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  PenTool,
  ShieldCheck,
} from "lucide-react";

export default function ChangeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  const load = () => {
    api
      .get(`/changes/${id}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [id]);

  const updateStatus = async (status) => {
    try {
      await api.patch(`/changes/${id}`, { status });
      toast.success(`Status diubah ke ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal update status");
    }
  };

  const handleApprove = async (signatureData) => {
    setSavingSignature(true);
    try {
      await api.post(`/changes/${id}/approve`, { signature_data: signatureData });
      toast.success("TTD digital berhasil disimpan!");
      setShowSignature(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menyimpan TTD");
    } finally {
      setSavingSignature(false);
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
        <div className="p-6">
          <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <div className="p-6 text-red-400">Change Request tidak ditemukan</div>
      </Layout>
    );

  const { change: cr, checkpoints, steps } = data;

  const isCore = cr.change_squad === "core";
  const isSigned = !!cr.signature_data;
  const needsApproval = isCore && !isSigned;
  const isApprover = user?.role === "approver";
  const isAdmin = user?.role === "admin";

  // Semua steps harus completed atau skipped sebelum bisa update status akhir
  const allStepsDone =
    steps.length > 0 &&
    steps.every(
      (s) =>
        s.status === "completed" ||
        s.status === "skipped" ||
        s.status === "failed",
    );
  const pendingStepsCount = steps.filter(
    (s) => s.status === "pending" || s.status === "in_progress",
  ).length;

  return (
    <Layout>
      {showSignature && (
        <SignatureCanvas
          onConfirm={handleApprove}
          onCancel={() => setShowSignature(false)}
        />
      )}
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        {/* Breadcrumb + actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/changes"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-2"
            >
              <ChevronLeft size={14} /> Change Management
            </Link>
            <h1 className="text-xl font-bold text-slate-100">{cr.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sky-400 text-sm">
                {cr.cr_number}
              </span>
              <StatusBadge status={cr.status} />
              <span className="text-xs text-slate-500 uppercase">
                {cr.environment}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400 uppercase font-medium">
                {cr.change_type}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {/* Approver TTD button */}
            {isApprover && isCore && cr.status === "approved" && (
              <button
                onClick={() => setShowSignature(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSigned
                    ? "bg-emerald-800/40 text-emerald-300 border border-emerald-700/50"
                    : "bg-sky-600 hover:bg-sky-500 text-white"
                }`}
              >
                {isSigned ? (
                  <><ShieldCheck size={14} /> TTD Tersimpan</>
                ) : (
                  <><PenTool size={14} /> Bubuhkan TTD Digital</>
                )}
              </button>
            )}

            {/* Mulai Deploy — blocked for unsigned core CRs */}
            {cr.status === "approved" && !isApprover && (
              <button
                onClick={() => {
                  if (needsApproval) {
                    toast.error("CR tipe Core harus ditandatangani Approver terlebih dahulu");
                    return;
                  }
                  updateStatus("in_progress");
                }}
                className={`btn-success flex items-center gap-2 ${
                  needsApproval ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={needsApproval ? "Tunggu TTD digital dari Approver" : ""}
              >
                <Play size={14} /> Mulai Deploy
              </button>
            )}
            {cr.status === "in_progress" && (
              <>
                {/* Warning jika masih ada step yang belum selesai */}
                {!allStepsDone && pendingStepsCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/40 border border-amber-700/40 rounded-lg px-3 py-2">
                    <AlertCircle size={13} />
                    {pendingStepsCount} step belum selesai
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!allStepsDone) {
                      toast.error(
                        `Masih ada ${pendingStepsCount} step yang belum selesai. Selesaikan semua steps terlebih dahulu.`,
                      );
                      return;
                    }
                    updateStatus("completed");
                  }}
                  className={`btn-success flex items-center gap-2 ${!allStepsDone ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={
                    !allStepsDone
                      ? `${pendingStepsCount} step belum selesai`
                      : ""
                  }
                >
                  <CheckCircle size={14} /> Success
                </button>
                <button
                  onClick={() => {
                    if (!allStepsDone) {
                      toast.error(
                        `Masih ada ${pendingStepsCount} step yang belum selesai. Selesaikan semua steps terlebih dahulu.`,
                      );
                      return;
                    }
                    updateStatus("completed_with_notes");
                  }}
                  className={`btn-secondary flex items-center gap-2 ${!allStepsDone ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={
                    !allStepsDone
                      ? `${pendingStepsCount} step belum selesai`
                      : ""
                  }
                >
                  ✓ Success With Notes
                </button>
                <button
                  onClick={() => updateStatus("rolled_back")}
                  className="btn-danger flex items-center gap-2"
                >
                  <AlertTriangle size={14} /> Rollback
                </button>
              </>
            )}
            <button
              onClick={downloadPDF}
              disabled={pdfLoading}
              className="btn-secondary flex items-center gap-2"
            >
              <Download size={14} />{" "}
              {pdfLoading ? "Generating..." : "PDF Report"}
            </button>
            <Link
              to={`/deploy/${id}`}
              className="btn-primary flex items-center gap-2"
            >
              <Server size={14} /> Deploy Monitor
            </Link>
          </div>
        </div>

        {/* Approval status banner */}
        {isCore && (
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              isSigned
                ? "bg-emerald-950/30 border-emerald-700/40 text-emerald-300"
                : "bg-amber-950/30 border-amber-700/40 text-amber-300"
            }`}
          >
            {isSigned ? (
              <ShieldCheck size={16} className="shrink-0" />
            ) : (
              <PenTool size={16} className="shrink-0" />
            )}
            <div className="text-sm">
              {isSigned ? (
                <>
                  <span className="font-semibold">Disetujui oleh {cr.signature_name}</span>
                  {cr.signature_at && (
                    <span className="text-xs text-emerald-400/70 ml-2">
                      {new Date(cr.signature_at).toLocaleString("id-ID")}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-semibold">
                  CR tipe Core — menunggu TTD digital dari Approver sebelum dapat di-deploy
                </span>
              )}
            </div>
            {/* Signature preview */}
            {isSigned && cr.signature_data && (
              <img
                src={cr.signature_data}
                alt="TTD"
                className="ml-auto h-10 rounded border border-emerald-700/30 bg-white"
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Left: CR details */}
          <div className="col-span-2 space-y-4">
            {/* Info card */}
            <div className="card space-y-3">
              <h2 className="font-semibold text-slate-200 text-sm uppercase tracking-wider text-slate-500">
                Detail CR
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Type", cr.change_type],
                  ["Squad", cr.change_squad === "core" ? "Core" : cr.change_squad === "non_core" ? "Non Core" : cr.change_squad || "—"],
                  ["Priority", cr.priority],
                  ["CAB Approved By", cr.cab_approved_by || "—"],
                  [
                    "CAB Approved At",
                    cr.cab_approved_at
                      ? new Date(cr.cab_approved_at).toLocaleString("id-ID")
                      : "—",
                  ],
                  [
                    "Jadwal Mulai",
                    new Date(cr.scheduled_start).toLocaleString("id-ID"),
                  ],
                  [
                    "Jadwal Selesai",
                    new Date(cr.scheduled_end).toLocaleString("id-ID"),
                  ],
                  ["Created By", cr.created_by_name || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-slate-500 text-xs">{k}</p>
                    <p className="text-slate-200 capitalize">{v}</p>
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs">Affected Systems</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(cr.affected_systems || []).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {cr.description && (
                <div>
                  <p className="text-slate-500 text-xs">Deskripsi</p>
                  <p className="text-slate-300 text-sm mt-0.5">
                    {cr.description}
                  </p>
                </div>
              )}
              {cr.rollback_plan && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">
                  <p className="text-amber-400 text-xs font-semibold mb-1">
                    ⚠ Rollback Plan
                  </p>
                  <p className="text-slate-300 text-sm">{cr.rollback_plan}</p>
                </div>
              )}
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-slate-200 mb-3">
                  Runbook Steps ({steps.length})
                </h2>
                <div className="space-y-2">
                  {steps.map((s) => (
                    <div
                      key={s.id}
                      className="flex gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/40"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                        {s.step_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-200">
                            {s.title}
                          </p>
                          <StatusBadge status={s.status} />
                        </div>
                        {s.command && (
                          <div className="mt-1.5 bg-slate-950 rounded px-2 py-1 font-mono text-xs text-sky-300">
                            $ {s.command}
                          </div>
                        )}
                        {s.duration_min && (
                          <p className="text-xs text-slate-600 mt-1">
                            <Clock size={10} className="inline mr-1" />~
                            {s.duration_min} menit
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Checkpoints */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                Checkpoints
                <span className="text-xs text-slate-500">
                  ({checkpoints.filter((c) => c.status === "passed").length}/
                  {checkpoints.length} passed)
                </span>
              </h2>
              {checkpoints.length === 0 ? (
                <p className="text-slate-500 text-sm">Belum ada checkpoint</p>
              ) : (
                <div className="space-y-2">
                  {checkpoints.map((cp, i) => (
                    <div
                      key={cp.id}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center text-xs
                          ${
                            cp.status === "passed"
                              ? "border-emerald-500 bg-emerald-900/40 text-emerald-400"
                              : cp.status === "failed"
                                ? "border-red-500 bg-red-900/40 text-red-400"
                                : "border-slate-600 bg-slate-800"
                          }`}
                        >
                          {cp.status === "passed"
                            ? "✓"
                            : cp.status === "failed"
                              ? "✗"
                              : i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200">{cp.name}</p>
                          {cp.team && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {cp.team}
                            </p>
                          )}
                          {cp.completed_by_name && (
                            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                              <User size={9} /> {cp.completed_by_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
