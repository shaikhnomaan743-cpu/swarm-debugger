import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const DEMO_IDENTIFIER = "demo@swarm.local";
const DEMO_PASSWORD = "demo";

export function LoginPage() {
  const { user, ready, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const [identifier, setIdentifier] = useState(DEMO_IDENTIFIER);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (ready && user) {
    return <Navigate to={from} replace />;
  }

  function validate(): boolean {
    let ok = true;
    const trimmed = identifier.trim();
    if (!trimmed) {
      setIdentifierError("Enter your email or username.");
      ok = false;
    } else {
      setIdentifierError("");
    }
    if (!password) {
      setPasswordError("Enter your password.");
      ok = false;
    } else {
      setPasswordError("");
    }
    return ok;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!validate()) {
      return;
    }
    setSubmitting(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <section className="relative w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-[0_0_0_1px_rgba(124,92,255,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">PS 02</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight">SWARM DEBUGGER</h1>
        <p className="mt-2 text-sm text-muted">
          Adversarial AI debugging with runtime verification
        </p>

        <form className="mt-8 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <label className="flex flex-col gap-2 text-sm">
            <span>
              Email <span className="font-normal text-muted">or username</span>
            </span>
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              type="text"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={Boolean(identifierError)}
              aria-describedby={identifierError ? "identifier-error" : undefined}
            />
            {identifierError ? (
              <span id="identifier-error" className="text-xs text-danger">
                {identifierError}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span>Password</span>
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "password-error" : undefined}
            />
            {passwordError ? (
              <span id="password-error" className="text-xs text-danger">
                {passwordError}
              </span>
            ) : null}
          </label>

          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            className="mt-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted">
          Demo account: <span className="font-mono text-text">{DEMO_IDENTIFIER}</span> /{" "}
          <span className="font-mono text-text">{DEMO_PASSWORD}</span>
        </p>
      </section>
    </main>
  );
}
