import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import api from "../api/client";
import { Plus, Search, FileText, ArrowRight } from "lucide-react";

const ENVIRONMENTS = ["prod", "staging", "dr", "dev"];
const PRIORITIES = ["critical", "high", "medium", "low"];
const TYPES = ["normal", "emergency", "standard"];

function priorityDot(p) {
  const c = {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-amber-400",
    low: "bg-slate-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${c[p] || "bg-slate-400"}`}
    />
  );
}

export default function ChangesPage() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEnv, setFilterEnv] = useState("");

  useEffect(() => {
    api
      .get("/changes")
      .then((r) => setChanges(r.data.changes))
      .finally(() => setLoading(false));
  }, []);

  const filtered = changes.filter((c) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      c.cr_number.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q);
    const matchSt = !filterStatus || c.status === filterStatus;
    const matchEn = !filterEnv || c.environment === filterEnv;
    return matchQ && matchSt && matchEn;
  });

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              Change Management
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Daftar Change Request yang sudah di-approve CAB
            </p>
          </div>
          <Link
            to="/changes/new"
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> New CR
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              className="input pl-9"
              placeholder="Cari CR number atau judul..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            {[
              { value: "approved", label: "Menunggu Deploy" },
              { value: "in_progress", label: "Sedang Berjalan" },
              { value: "completed", label: "Success" },
              { value: "completed_with_notes", label: "Success With Notes" },
              { value: "rolled_back", label: "Rollback" },
            ].map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value)}
          >
            <option value="">Semua Env</option>
            {ENVIRONMENTS.map((e) => (
              <option key={e} value={e}>
                {e.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-slate-500 font-medium">
                    CR Number
                  </th>
                  <th className="px-4 py-3 text-slate-500 font-medium">
                    Judul
                  </th>
                  <th className="px-4 py-3 text-slate-500 font-medium">Type</th>
                  <th className="px-4 py-3 text-slate-500 font-medium">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-slate-500 font-medium">Env</th>
                  <th className="px-4 py-3 text-slate-500 font-medium">
                    Jadwal Mulai
                  </th>
                  <th className="px-4 py-3 text-slate-500 font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/30"}`}
                    >
                      <td className="px-4 py-3 font-mono text-sky-400 font-medium">
                        {c.cr_number}
                      </td>
                      <td className="px-4 py-3 text-slate-200 max-w-xs truncate">
                        {c.title}
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">
                        {c.change_type}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          {priorityDot(c.priority)} {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {c.environment?.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(c.scheduled_start).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/changes/${c.id}`}
                          className="text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
