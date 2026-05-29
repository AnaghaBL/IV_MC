import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, BarChart3, FileText, Gauge, LogOut, Moon, Settings, Smartphone, Stethoscope, Sun } from "lucide-react";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/auth";
import { api } from "../../services/api";
import { useSocket } from "../../hooks/useSocket";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/devices", label: "Devices", icon: Activity },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/mobile", label: "Nurse Mobile", icon: Smartphone }
];

export const AppShell = () => {
  useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { staff, clearSession } = useAuthStore();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark") || localStorage.getItem("dripsense.theme") === "dark");

  const activeWard = new URLSearchParams(location.search).get("ward") ?? "All Wards";
  const selectWard = (ward: string) => navigate(ward === "All Wards" ? "/dashboard" : `/dashboard?ward=${encodeURIComponent(ward)}`);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  const toggleDark = () => {
    const next = !darkMode;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dripsense.theme", next ? "dark" : "light");
    setDarkMode(next);
  };
  const logout = async () => {
    await api.logout().catch(() => undefined);
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-medical-bg text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-medical-border bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Stethoscope className="h-6 w-6 text-medical-blue" />
            <span>DripSense AI</span>
          </div>
          <div className="hidden gap-2 md:flex">
            {["All Wards", "ICU", "Surgical Ward", "General Ward"].map((ward) => (
              <button className={`focusable rounded-full px-3 py-1.5 text-sm ${activeWard === ward ? "bg-medical-blue-light font-semibold text-medical-blue dark:bg-zinc-800" : "text-medical-muted hover:bg-medical-blue-light hover:text-medical-blue dark:hover:bg-zinc-800"}`} key={ward} onClick={() => selectWard(ward)}>{ward}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={toggleDark} aria-label="Toggle dark mode">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <div className="hidden text-right text-sm sm:block">
              <div className="font-semibold">{staff?.name ?? "Clinical User"}</div>
              <div className="text-xs text-medical-muted">{staff?.role ?? "NURSE"}</div>
            </div>
            <Button variant="ghost" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="fixed bottom-0 left-0 right-0 z-30 border-t border-medical-border bg-white dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-64 md:border-r md:border-t-0">
          <nav className="flex justify-around p-2 md:block md:space-y-1 md:p-3">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `focusable flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-medical-blue-light text-medical-blue dark:bg-zinc-800" : "text-medical-muted hover:bg-zinc-100 dark:hover:bg-zinc-800"}`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="w-full pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
