import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/client";
import toast from "react-hot-toast";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const defaultStep = () => ({
  step_number: 1,
  title: "",
  description: "",
  command: "",
  expected_result: "",
  rollback_cmd: "",
  duration_min: 5,
});
const defaultCp = () => ({ name: "", description: "", team: "" });

// Definisikan di LUAR komponen agar tidak di-recreate setiap render
function Section({ id, title, open, onToggle, children }) {
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="font-semibold text-slate-200">{title}</h3>
        {open ? (
          <ChevronUp size={16} className="text-slate-500" />
        ) : (
          <ChevronDown size={16} className="text-slate-500" />
        )}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function NewChangePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cr_number: "",
    title: "",
    description: "",
    change_type: "normal",
    priority: "medium",
    environment: "prod",
    affected_systems: "",
    scheduled_start: "",
    scheduled_end: "",
    rollback_plan: "",
    cab_approved_by: "",
    cab_approved_at: "",
  });
  const [checkpoints, setCheckpoints] = useState([defaultCp()]);
  const [steps, setSteps] = useState([defaultStep()]);
  const [openSections, setOpenSections] = useState({
    info: true,
    checkpoints: true,
    steps: true,
  });

  const toggleSection = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCp = (i, k, v) =>
    setCheckpoints((cps) =>
      cps.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)),
    );
  const addCp = () => setCheckpoints((cps) => [...cps, defaultCp()]);
  const removeCp = (i) =>
    setCheckpoints((cps) => cps.filter((_, idx) => idx !== i));

  // Steps
  const setStep = (i, k, v) =>
    setSteps((ss) => ss.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const addStep = () =>
    setSteps((ss) => [...ss, { ...defaultStep(), step_number: ss.length + 1 }]);
  const removeStep = (i) =>
    setSteps((ss) =>
      ss
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, step_number: idx + 1 })),
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        affected_systems: form.affected_systems
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        checkpoints,
        steps,
      };
      const res = await api.post("/changes", payload);
      toast.success(`CR ${res.data.change.cr_number} berhasil dibuat!`);
      navigate(`/changes/${res.data.change.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal membuat Change Request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Buat Change Request Baru
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Isi data CR yang sudah di-approve CAB, checkpoint, dan runbook steps
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── CR Info ── */}
          <Section
            id="info"
            title="Informasi Change Request"
            open={openSections.info}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CR Number *</label>
                <input
                  className="input font-mono"
                  placeholder="CHG0012345"
                  value={form.cr_number}
                  onChange={(e) => setField("cr_number", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Change Type *</label>
                <select
                  className="input"
                  value={form.change_type}
                  onChange={(e) => setField("change_type", e.target.value)}
                >
                  {["normal", "emergency", "standard", "core", "digital"].map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Judul *</label>
                <input
                  className="input"
                  placeholder="Judul singkat deployment"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="label">Deskripsi</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Detail perubahan yang akan dilakukan..."
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Priority *</label>
                <select
                  className="input"
                  value={form.priority}
                  onChange={(e) => setField("priority", e.target.value)}
                >
                  {["critical", "high", "medium", "low"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Environment *</label>
                <select
                  className="input"
                  value={form.environment}
                  onChange={(e) => setField("environment", e.target.value)}
                >
                  {["prod", "staging", "dr", "dev"].map((env) => (
                    <option key={env} value={env}>
                      {env.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">
                  Affected Systems (pisahkan koma)
                </label>
                <input
                  className="input"
                  placeholder="service-auth, service-payment, kafka-cluster"
                  value={form.affected_systems}
                  onChange={(e) => setField("affected_systems", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Jadwal Mulai *</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.scheduled_start}
                  onChange={(e) => setField("scheduled_start", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Jadwal Selesai *</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.scheduled_end}
                  onChange={(e) => setField("scheduled_end", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">CAB Approved By</label>
                <input
                  className="input"
                  placeholder="Nama approver"
                  value={form.cab_approved_by}
                  onChange={(e) => setField("cab_approved_by", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Tanggal Approval CAB</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.cab_approved_at}
                  onChange={(e) => setField("cab_approved_at", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Rollback Plan</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Langkah rollback jika deployment gagal..."
                  value={form.rollback_plan}
                  onChange={(e) => setField("rollback_plan", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* ── Checkpoints ── */}
          <Section
            id="checkpoints"
            title="Pre-Deployment Checkpoints"
            open={openSections.checkpoints}
            onToggle={toggleSection}
          >
            <div className="space-y-3">
              {checkpoints.map((cp, i) => (
                <div
                  key={i}
                  className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">
                      CHECKPOINT {i + 1}
                    </span>
                    {checkpoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCp(i)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">Nama Checkpoint *</label>
                      <input
                        className="input"
                        placeholder="Misal: Validasi Backup DB"
                        value={cp.name}
                        onChange={(e) => setCp(i, "name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Team</label>
                      <input
                        className="input"
                        placeholder="DBA, Network, Infra..."
                        value={cp.team}
                        onChange={(e) => setCp(i, "team", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Deskripsi</label>
                      <input
                        className="input"
                        placeholder="Detail singkat..."
                        value={cp.description}
                        onChange={(e) =>
                          setCp(i, "description", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCp}
                className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus size={15} /> Tambah Checkpoint
              </button>
            </div>
          </Section>

          {/* ── Steps ── */}
          <Section
            id="steps"
            title="Deployment Runbook Steps"
            open={openSections.steps}
            onToggle={toggleSection}
          >
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">
                      STEP {s.step_number}
                    </span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">Judul Step *</label>
                      <input
                        className="input"
                        placeholder="Misal: Deploy service-auth v2.1.0"
                        value={s.title}
                        onChange={(e) => setStep(i, "title", e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Deskripsi</label>
                      <textarea
                        className="input resize-none"
                        rows={2}
                        value={s.description}
                        onChange={(e) =>
                          setStep(i, "description", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Command</label>
                      <input
                        className="input font-mono text-sm"
                        placeholder="kubectl rollout restart deployment/service-auth"
                        value={s.command}
                        onChange={(e) => setStep(i, "command", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Expected Result</label>
                      <input
                        className="input"
                        placeholder="Pod berjalan, health check OK"
                        value={s.expected_result}
                        onChange={(e) =>
                          setStep(i, "expected_result", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Rollback Command</label>
                      <input
                        className="input font-mono text-sm"
                        placeholder="kubectl rollout undo deployment/service-auth"
                        value={s.rollback_cmd}
                        onChange={(e) =>
                          setStep(i, "rollback_cmd", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Estimasi Durasi (menit)</label>
                      <input
                        type="number"
                        min={1}
                        className="input"
                        value={s.duration_min}
                        onChange={(e) =>
                          setStep(i, "duration_min", +e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus size={15} /> Tambah Step
              </button>
            </div>
          </Section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/changes")}
              className="btn-secondary"
            >
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Menyimpan..." : "Buat Change Request"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
