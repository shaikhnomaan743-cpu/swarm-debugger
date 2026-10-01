import { useState } from "react";

export function SettingsPage() {
  const [motion, setMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Accessibility</h2>
        <label className="mt-2 flex items-center gap-2">
          <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
          Reduced motion (3D scenes render static frames; all data remains in lists and tables)
        </label>
        <p className="mt-2 text-xs text-muted">
          All debugging information exists in normal UI: 3D visuals enhance but never replace evidence.
          Status is always labeled with text, never color alone. Keyboard: Tab to navigate, ⌘/Ctrl+K for commands.
        </p>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Research positioning</h2>
        <p className="mt-1 text-muted">
          Swarm Debugger operationalizes adversarial debugging through executable evidence —
          Prosecutor/Defender interaction, falsification tests, runtime traces, evidence memory,
          causal graphs, a deterministic Judge, rejection-driven rounds, benchmarks, and replay.
        </p>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4 font-mono text-[11px] text-muted">
        <p>Backend: FastAPI + SQLite · Sandbox: Docker (process fallback labeled, strict mode refuses unsafe execution)</p>
        <p>Languages: Python supported today; Node/Java/C++/Go adapters report unsupported until execution works.</p>
      </section>
    </main>
  );
}
