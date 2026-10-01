import { Link, useParams } from "react-router-dom";
import { ReportView } from "../components/ReportView";
import { useSessionLive } from "../hooks/useSessionLive";

export function ReportPage() {
  const { sessionId } = useParams();
  const { session, error } = useSessionLive(sessionId);

  if (!session && !error) {
    return <p className="px-6 py-10 text-sm text-muted">Loading report…</p>;
  }

  if (!session) {
    return (
      <main className="px-6 py-10">
        <Link className="text-xs text-muted hover:text-text" to="/app/history">
          ← History
        </Link>
        <p className="mt-4 text-sm text-danger">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 lg:px-6">
      <div>
        <Link className="text-xs text-muted hover:text-text" to={`/app/sessions/${session.id}`}>
          ← Back to workspace
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{session.project_name} — report</h1>
        <p className="mt-1 font-mono text-xs text-muted">{session.id}</p>
      </div>
      <ReportView session={session} />
    </main>
  );
}
