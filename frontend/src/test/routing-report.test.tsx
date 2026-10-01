import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { AuthContext } from "../hooks/useAuth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { buildReportMarkdown } from "../components/ReportView";
import type { SessionDetail } from "../types";

function renderGuard(user: { id: string; email: string; username: string } | null) {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <AuthContext.Provider
        value={{ user, ready: true, signIn: async () => undefined, signOut: async () => undefined }}
      >
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <p>secret workspace</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("renders children for signed-in users", () => {
    renderGuard({ id: "1", email: "demo@swarm.local", username: "demo" });
    expect(screen.getByText("secret workspace")).toBeInTheDocument();
  });

  it("redirects signed-out users to login", () => {
    renderGuard(null);
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret workspace")).not.toBeInTheDocument();
  });
});

const SESSION = {
  id: "sess-1",
  project_name: "demo-divide",
  language: "python",
  status: "verified",
  current_round: 1,
  max_rounds: 5,
  demo_mode: true,
  terminated_reason: "verified_fix",
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
  description: "divide() crashes on zero",
  test_command: "pytest -q",
  entry_point: "solution.py",
  last_error: null,
  files: [],
  rounds: [
    {
      id: "r1",
      session_id: "sess-1",
      number: 1,
      status: "completed",
      summary: "Verified fix found",
      created_at: "2026-01-01",
      candidates: [
        {
          id: "c1",
          session_id: "sess-1",
          round_id: "r1",
          agent: "prosecutor",
          root_cause: "missing guard",
          hypothesis: "h",
          patch_summary: "Guard b == 0",
          files: [],
          files_changed: ["solution.py"],
          expected_result: "returns None",
          expected_tests: [],
          objections: "",
          falsification_tests: "",
          status: "VERIFIED",
          demo_mode: true,
          created_at: "2026-01-01",
        },
      ],
      decisions: [
        {
          id: "d1",
          session_id: "sess-1",
          round_id: "r1",
          candidate_id: "c1",
          verdict: "PASSED",
          reason: "All recorded tests passed",
          evidence_summary: "exit_code=0 tests_total=2",
          llm_explanation: "demo",
          created_at: "2026-01-01",
        },
      ],
    },
  ],
  executions: [
    {
      id: "e1",
      session_id: "sess-1",
      round_id: null,
      candidate_id: null,
      kind: "baseline",
      status: "FAILED",
      exit_code: 1,
      duration_ms: 100,
      stdout: "1 failed",
      stderr: "",
      tests_total: 2,
      tests_passed: 1,
      tests_failed: 1,
      timed_out: false,
      protected_files_tampered: false,
      sandbox_backend: "process",
      failure_summary: null,
      created_at: "2026-01-01",
    },
  ],
  messages: [],
  events: [],
} as unknown as SessionDetail;

describe("buildReportMarkdown", () => {
  it("includes baseline, candidates, and verified outcome", () => {
    const md = buildReportMarkdown(SESSION);
    expect(md).toContain("demo-divide");
    expect(md).toContain("Baseline result");
    expect(md).toContain("Guard b == 0");
    expect(md).toContain("Verified fix by prosecutor");
    expect(md).toContain("source of truth");
  });
});
