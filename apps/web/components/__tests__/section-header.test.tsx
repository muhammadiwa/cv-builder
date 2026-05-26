import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader } from "../section-header";

describe("SectionHeader", () => {
  it("renders the required title", () => {
    render(<SectionHeader title="Hello" />);
    expect(screen.getByRole("heading", { name: /hello/i })).toBeInTheDocument();
  });

  it("renders the optional tag, highlight, and description when provided", () => {
    render(
      <SectionHeader
        tag="WHY US"
        title="Build CVs"
        highlight="that lolos ATS"
        description="Powered by AI."
      />,
    );
    expect(screen.getByText("WHY US")).toBeInTheDocument();
    expect(screen.getByText(/that lolos ATS/i)).toBeInTheDocument();
    expect(screen.getByText("Powered by AI.")).toBeInTheDocument();
  });

  it("omits optional bits when not provided", () => {
    render(<SectionHeader title="Bare" />);
    // No tag, no description — heading-only smoke.
    expect(screen.getByRole("heading", { name: /bare/i })).toBeInTheDocument();
    expect(screen.queryByText(/why us/i)).toBeNull();
  });
});
