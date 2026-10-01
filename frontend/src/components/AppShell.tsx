import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getSystemStatus } from "../services/api";
import type { SystemStatus } from "../types";
import { StatusDot } from "./StatusDot";

const LINK = "text-xs text-muted transition hover:text-text";
const ACTIVE = "text-xs text-text";

const NAV: { to: string; label: string }[] = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/arena", label: "Arena" },
  { to: "/app/evidence", label: "Evidence" },
  { to: "/app/trace", label: "Trace" },
  { to: "/app/causal", label: "Causal" },
  { to: "/app/replay", label: "Replay" },
  { to: "/app/benchmarks", label: "Benchmarks" },
  { to: "/app/ablation", label: "Ablation" },
  { to: "/app/experiments", label: "Experiments" },
  { to: "/app/sandbox", label: "Sandbox" },
  { to: "/app/health", label: "Health" },
  { to: "/app/history", label: "History" },
  { to: "/app/new", label: "New" },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const [system, setSystem] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSystemStatus()
      .then((status) => {
        if (!cancelled) setSystem(status);
      })
      .catch(() => {
        if (!cancelled) setSystem(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <NavLink to="/app" className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">PS 02</span>
              <span className="text-sm font-semibold">Swarm Debugger</span>
            </NavLink>
            <nav className="flex flex-wrap items-center gap-3" aria-label="Primary">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) => (isActive ? ACTIVE : LINK)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {system ? (
              <>
                <StatusDot label={`Sandbox ${system.sandbox_backend}`} ok={system.sandbox_available} />
                <StatusDot label={`LLM ${system.llm_mode}`} ok={system.llm_mode !== "error"} />
              </>
            ) : (
              <span className="text-xs text-muted">System status unavailable</span>
            )}
            <span className="text-xs text-muted">{user?.email}</span>
            <button
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              type="button"
              onClick={() => void signOut()}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
