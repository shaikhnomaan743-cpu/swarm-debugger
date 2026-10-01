import { useEffect, useMemo, useState } from "react";
import { EvidenceCard } from "../components/EvidenceCard";
import { getEvidence } from "../services/extended";
import type { EvidenceItem } from "../types/extended";
import { SessionPicker, useSessionOptions } from "./_shared";

const TYPES = ["all", "TEST_RESULT", "RUNTIME_TRACE", "FALSIFICATION_RESULT", "HYPOTHESIS",
  "COUNTER_ARGUMENT", "FAULT_LOCATION", "DIFF", "BASELINE_RESULT", "VARIABLE_STATE"];

export function EvidenceExplorerPage() {
  const { sessions, selected, setSelected } = useSessionOptions();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!selected) return;
    getEvidence(selected).then(setItems).catch(() => setItems([]));
  }, [selected]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Evidence Explorer</h1>
          <p className="text-sm text-muted">Every claim links to executable evidence. Confidence is never proof.</p>
        </div>
        <SessionPicker sessions={sessions} selected={selected} onChange={setSelected} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label="Filter evidence">
        {TYPES.map((t) => (
          <button
            key={t} type="button" onClick={() => setFilter(t)}
            className={`rounded border px-2 py-1 font-mono ${filter === t ? "border-primary bg-surface-2" : "border-border"}`}
            aria-pressed={filter === t}
          >
            {t}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No evidence yet — start the session to generate baseline, trace, and Judge records.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <EvidenceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
