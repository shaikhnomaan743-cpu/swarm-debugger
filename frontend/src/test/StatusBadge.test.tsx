import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../components/StatusBadge";

describe("StatusBadge", () => {
  it("renders verified status with label", () => {
    render(<StatusBadge status="VERIFIED" />);
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
  });

  it("humanizes snake_case session states", () => {
    render(<StatusBadge status="human_review" />);
    expect(screen.getByText("HUMAN REVIEW")).toBeInTheDocument();
  });

  it("falls back gracefully for unknown statuses", () => {
    render(<StatusBadge status="something_new" />);
    expect(screen.getByText("SOMETHING NEW")).toBeInTheDocument();
  });
});
