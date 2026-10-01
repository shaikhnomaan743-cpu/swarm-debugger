import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const COMMANDS: { label: string; run: (nav: (p: string) => void) => void }[] = [
  { label: "New Debug Session", run: (nav: (p: string) => void) => nav("/app/new") },
  { label: "Open Dashboard", run: (nav) => nav("/app") },
  { label: "Open History", run: (nav) => nav("/app/history") },
  { label: "Open Agent Arena", run: (nav) => nav("/app/arena") },
  { label: "Open Evidence Explorer", run: (nav) => nav("/app/evidence") },
  { label: "Open Runtime Trace", run: (nav) => nav("/app/trace") },
  { label: "Open Causal Graph", run: (nav) => nav("/app/causal") },
  { label: "Open Replay", run: (nav) => nav("/app/replay") },
  { label: "Run Benchmark Lab", run: (nav) => nav("/app/benchmarks") },
  { label: "Run Ablation Lab", run: (nav) => nav("/app/ablation") },
  { label: "Open Sandbox Monitor", run: (nav) => nav("/app/sandbox") },
  { label: "Open System Health", run: (nav) => nav("/app/health") },
  { label: "Open Settings", run: (nav) => nav("/app/settings") },
];

/** Global command palette (Cmd/Ctrl+K). */
export function CommandPalette() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(
    () => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-6" role="dialog" aria-label="Command palette">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-3 shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command… (Esc to close)"
          className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Command search"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {items.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                onClick={() => {
                  c.run(nav);
                  setOpen(false);
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
          {items.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}
