type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "add"; text: string }
  | { kind: "del"; text: string };

/** Tiny LCS line diff — dependency-free, good enough for patch review. */
function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length;
  const n = b.length;
  // Guard against pathological sizes; fall back to full replace view.
  if (m * n > 200_000) {
    return [
      ...a.map((text): DiffLine => ({ kind: "del", text })),
      ...b.map((text): DiffLine => ({ kind: "add", text })),
    ];
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i] });
      i++;
    } else {
      out.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ kind: "del", text: a[i++] });
  while (j < n) out.push({ kind: "add", text: b[j++] });
  return out;
}

export function DiffViewer({ before, after, path }: { before: string; after: string; path: string }) {
  const lines = diffLines(before ?? "", after ?? "");
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

  if (added === 0 && removed === 0) {
    return (
      <div className="rounded-md border border-border bg-bg p-3 text-xs text-muted">
        <span className="font-mono">{path}</span> — identical to the original (no changes).
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5 font-mono text-[11px]">
        <span className="truncate text-muted">{path}</span>
        <span>
          <span className="text-judge">+{added}</span> <span className="text-danger">-{removed}</span>
        </span>
      </div>
      <pre className="max-h-72 overflow-auto bg-bg p-0 font-mono text-[12px] leading-5">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={
              line.kind === "add"
                ? "bg-judge/10 px-3 text-text"
                : line.kind === "del"
                  ? "bg-danger/10 px-3 text-text"
                  : "px-3 text-muted"
            }
          >
            <span className="mr-2 inline-block w-3 select-none opacity-60">
              {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
            </span>
            {line.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
