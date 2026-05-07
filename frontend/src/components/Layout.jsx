import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Activity,
  LogOut,
  User,
  Shield,
  Link2,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/changes", label: "Change Mgmt", icon: FileText },
  { to: "/checkpoints", label: "Checkpoints", icon: CheckSquare },
  { to: "/deploy", label: "Deploy Monitor", icon: Activity },
];

const adminNavItems = [
  { to: "/admin/invite", label: "Invite Links", icon: Link2 },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#020617" }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col shrink-0"
        style={{
          background: "rgba(255,255,255,0.025)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Brand */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.25)",
                boxShadow: "0 0 16px rgba(56,189,248,0.2)",
              }}
            >
              <Shield className="text-sky-400" size={16} />
            </div>
            <div>
              <p className="font-bold text-slate-100 text-sm tracking-tight leading-none">SRE Deploy</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Deployment Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {[...navItems, ...(user?.role === "superuser" ? adminNavItems : [])].map(({ to, label, icon: Icon }) => {
            const active =
              location.pathname === to ||
              (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={
                  active
                    ? {
                        background: "rgba(56,189,248,0.1)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        color: "#7dd3fc",
                        boxShadow: "0 0 12px rgba(56,189,248,0.1)",
                      }
                    : {
                        background: "transparent",
                        border: "1px solid transparent",
                        color: "#64748b",
                      }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.color = "#cbd5e1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#64748b";
                  }
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div
          className="px-4 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex items-center gap-2.5 p-2.5 rounded-xl mb-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "rgba(56,189,248,0.2)",
                border: "1px solid rgba(56,189,248,0.3)",
                boxShadow: "0 0 8px rgba(56,189,248,0.15)",
              }}
            >
              <User size={12} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name}
              </p>
              <p className="text-[10px] text-slate-500 capitalize">
                {user?.role} · {user?.team || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-red-400 transition-colors duration-200 w-full px-2 py-1.5 rounded-lg"
            style={{ cursor: "pointer" }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto" style={{ background: "#020617" }}>
        {children}
      </main>
    </div>
  );
}
