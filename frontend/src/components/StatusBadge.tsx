type StatusBadgeProps = {
  status: string;
};

const TONE: Record<string, string> = {
  created: "border-border text-muted",
  running: "border-warning/40 bg-warning/10 text-warning",
  verified: "border-judge/40 bg-judge/10 text-judge",
  cancelled: "border-border text-muted",
  terminated: "border-danger/40 bg-danger/10 text-danger",
  human_review: "border-warning/40 bg-warning/10 text-warning",
  PROPOSED: "border-primary/40 bg-primary/10 text-primary",
  RUNNING: "border-warning/40 bg-warning/10 text-warning",
  PASSED: "border-judge/40 bg-judge/10 text-judge",
  FAILED: "border-danger/40 bg-danger/10 text-danger",
  REJECTED: "border-danger/40 bg-danger/10 text-danger",
  TIMEOUT: "border-warning/40 bg-warning/10 text-warning",
  SANDBOX_ERROR: "border-danger/40 bg-danger/10 text-danger",
  VERIFIED: "border-judge/40 bg-judge/10 text-judge",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONE[status] ?? "border-border text-muted";
  const label = status.replaceAll("_", " ").toUpperCase();
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] tracking-wide ${tone}`}>
      {label}
    </span>
  );
}
