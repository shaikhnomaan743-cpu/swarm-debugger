type StatusDotProps = {
  label: string;
  ok: boolean;
};

export function StatusDot({ label, ok }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        className={`h-2 w-2 rounded-full ${ok ? "bg-judge" : "bg-prosecutor"}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
