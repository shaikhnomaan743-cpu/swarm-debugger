import { useAuth } from "../hooks/useAuth";

export function SignedInPage() {
  const { user, signOut } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">PS 02</p>
          <h1 className="mt-2 text-[28px] font-semibold">Swarm Debugger</h1>
          <p className="mt-2 text-sm text-muted">Signed in. Dashboard is Phase 2 and is not built yet.</p>
        </div>
        <button
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm transition hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
          type="button"
          onClick={() => void signOut()}
        >
          Log out
        </button>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          <span className="text-muted">User</span> {user?.username}
        </p>
        <p className="mt-1">
          <span className="text-muted">Email</span> {user?.email}
        </p>
      </section>
    </main>
  );
}
