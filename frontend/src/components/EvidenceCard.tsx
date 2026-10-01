import { memo } from "react";
import type { EvidenceItem } from "../types/extended";

/** Evidence-first card: AI claims visually distinct from executable evidence. */
export const EvidenceCard = memo(function EvidenceCard({ item }: { item: EvidenceItem }) {
  const verified = item.verification_state === "verified";
  return (
    <article className={`rounded border p-3 ${verified ? "border-judge/40 bg-judge/5" : "border-border bg-surface-2"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">
          {item.type} · R{item.round} · {item.agent || item.source}
        </span>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] ${
            verified ? "bg-judge text-white" : "bg-surface border border-border text-muted"
          }`}
        >
          {verified ? "✓ EXECUTION EVIDENCE" : "○ AI CLAIM / OBSERVED"}
        </span>
      </div>
      <h4 className="mt-1 text-sm font-semibold">{item.title}</h4>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted">
        {item.content.slice(0, 1500)}
      </pre>
    </article>
  );
});
