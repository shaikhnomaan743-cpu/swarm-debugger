import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "../pages/LandingPage";

describe("LandingPage", () => {
  it("renders the hero, arena entry points, and code comparison", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Debugging should prove itself.")).toBeInTheDocument();
    expect(screen.getByText("Competing AI agents. Real execution. Evidence-driven verification.")).toBeInTheDocument();
    expect(screen.getByText("Prosecutor's Fix")).toBeInTheDocument();
    expect(screen.getByText("Defender's Alternative")).toBeInTheDocument();
    expect(screen.getByText("FAILED")).toBeInTheDocument();
    expect(screen.getByText("Test Execution")).toBeInTheDocument();
    const runLinks = screen.getAllByText("▶ Run Tests");
    expect(runLinks.length).toBeGreaterThan(0);
  });
});
