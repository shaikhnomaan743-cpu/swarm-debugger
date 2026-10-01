import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffViewer } from "../components/DiffViewer";

describe("DiffViewer", () => {
  it("shows identical notice when nothing changed", () => {
    render(<DiffViewer before="a\nb\n" after="a\nb\n" path="solution.py" />);
    expect(screen.getByText(/identical to the original/)).toBeInTheDocument();
  });

  it("shows added and removed counts for a patch", () => {
    render(
      <DiffViewer
        before={"def divide(a, b):\n    return a / b\n"}
        after={"def divide(a, b):\n    if b == 0:\n        return None\n    return a / b\n"}
        path="solution.py"
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("-0")).toBeInTheDocument();
    expect(screen.getByText("solution.py")).toBeInTheDocument();
  });
});
