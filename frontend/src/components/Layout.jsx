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
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/changes", label: "Change Mgmt", icon: FileText },
  { to: "/checkpoints", label: "Checkpoints", icon: CheckSquare },
  { to: "/deploy", label: "Deploy Monitor", icon: Activity },
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="text-sky-400" size={20} />
            <span className="font-bold text-slate-100 tracking-tight">
              SRE Deploy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Deployment Manager</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active =
              location.pathname === to ||
              (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sky-600/20 text-sky-300 border border-sky-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center">
              <User size={13} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role} · {user?.team || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-slate-900">{children}</main>
    </div>
  );
}
