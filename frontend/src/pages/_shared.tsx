import { useEffect, useState } from "react";
import { listSessions } from "../services/api";
import type { SessionSummary } from "../types";

export function useSessionOptions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    listSessions()
      .then((s) => {
        setSessions(s);
        if (s[0] && !selected) setSelected(s[0].id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { sessions, selected, setSelected };
}

export function SessionPicker({
  sessions, selected, onChange,
}: {
  sessions: SessionSummary[];
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      Session
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-text"
        aria-label="Select debug session"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.project_name} — {s.status}
          </option>
        ))}
      </select>
    </label>
  );
}
