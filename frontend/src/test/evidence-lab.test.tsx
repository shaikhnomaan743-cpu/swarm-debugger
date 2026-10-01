import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EvidenceCard } from "../components/EvidenceCard";
import { StateMachineBar } from "../components/StateMachineBar";
import { HypothesisBattle3D } from "../components/three/HypothesisBattle3D";

describe("StateMachineBar", () => {
  it("renders all deterministic phases", () => {
    render(<StateMachineBar status="running" currentRound={1} />);
    for (const phase of ["BASELINE", "LOCALIZE", "PROSECUTOR", "DEFENDER", "EXECUTE", "TRACE", "JUDGE", "VERIFIED"]) {
      expect(screen.getByText(phase)).toBeInTheDocument();
    }
  });
});

describe("EvidenceCard", () => {
  it("distinguishes execution evidence from AI claims", () => {
    render(
      <EvidenceCard
        item={{
          id: "1", session_id: "s", round_id: null, candidate_id: null, round: 1,
          source: "sandbox", type: "TEST_RESULT", agent: "judge",
          title: "Judge verdict", content: "exit_code=0", verification_state: "verified",
          created_at: "",
        }}
      />,
    );
    expect(screen.getByText("✓ EXECUTION EVIDENCE")).toBeInTheDocument();
  });

  it("marks unverified claims as observed", () => {
    render(
      <EvidenceCard
        item={{
          id: "2", session_id: "s", round_id: null, candidate_id: null, round: 1,
          source: "llm", type: "HYPOTHESIS", agent: "prosecutor",
          title: "Hypothesis A", content: "missing guard", verification_state: "unverified",
          created_at: "",
        }}
      />,
    );
    expect(screen.getByText("○ AI CLAIM / OBSERVED")).toBeInTheDocument();
  });
});

describe("HypothesisBattle3D", () => {
  it("renders both hypotheses with accessible evidence text", () => {
    render(
      <MemoryRouter>
        <HypothesisBattle3D
          a={{
            id: "a", session_id: "s", round_id: "r", agent: "prosecutor",
            root_cause: "r", hypothesis: "Null validation missing", patch_summary: "p",
            files: [], files_changed: [], expected_result: "", expected_tests: [],
            objections: "", falsification_tests: "", status: "PASSED", demo_mode: true,
            created_at: "",
          }}
          b={{
            id: "b", session_id: "s", round_id: "r", agent: "defender",
            root_cause: "r2", hypothesis: "Incorrect state transition", patch_summary: "p2",
            files: [], files_changed: [], expected_result: "", expected_tests: [],
            objections: "", falsification_tests: "", status: "FAILED", demo_mode: true,
            created_at: "",
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Null validation missing/)).toBeInTheDocument();
    expect(screen.getByText(/Incorrect state transition/)).toBeInTheDocument();
  });
});
