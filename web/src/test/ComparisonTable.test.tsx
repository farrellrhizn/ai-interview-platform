import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable", () => {
  it("renders empty state gracefully when no comparisons are provided", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(
      screen.getByText(/No skill expectations configured for this vacancy/i)
    ).toBeInTheDocument();
  });

  it("renders required level, candidate level, delta badge, and override indicator correctly", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "React / Frontend Development Core",
        skill_id: "SK-ENG-001",
        required_level: 2,
        expected_level: 2,
        candidate_level: 3,
        ai_level: 2,
        result: "exceed",
        delta: 1,
        is_override: true,
        assessor_notes: "Demonstrated strong architecture thinking in live interview.",
        confidence: "high",
      },
      {
        skill_label: "TypeScript & Type Systems",
        skill_id: "SK-ENG-009",
        required_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
        is_override: false,
        confidence: "medium",
      },
      {
        skill_label: "System Design & Architecture",
        skill_id: "SK-ENG-003",
        required_level: 3,
        candidate_level: 1,
        result: "gap",
        delta: -2,
        is_override: false,
        confidence: "low",
      },
      {
        skill_label: "DevOps & CI/CD",
        skill_id: "SK-ENG-007",
        required_level: 2,
        candidate_level: null,
        result: "not_assessed",
        delta: null,
        is_override: false,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    // Check skill labels
    expect(screen.getByText("React / Frontend Development Core")).toBeInTheDocument();
    expect(screen.getByText("TypeScript & Type Systems")).toBeInTheDocument();
    expect(screen.getByText("System Design & Architecture")).toBeInTheDocument();
    expect(screen.getByText("DevOps & CI/CD")).toBeInTheDocument();

    // Check canonical skill ID pills
    expect(screen.getByText("SK-ENG-001")).toBeInTheDocument();
    expect(screen.getByText("SK-ENG-009")).toBeInTheDocument();

    // Check override callout and assessor notes
    expect(screen.getByText("Calibrated (AI L2 → L3)")).toBeInTheDocument();
    expect(
      screen.getByText('"Demonstrated strong architecture thinking in live interview."')
    ).toBeInTheDocument();

    // Check result badges
    expect(screen.getByText("Exceeds +1")).toBeInTheDocument();
    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByText("Gap -2")).toBeInTheDocument();
    expect(screen.getAllByText(/Not assessed/i).length).toBeGreaterThanOrEqual(1);

    // Check summary legend
    expect(screen.getByText(/human assessor override applied/i)).toBeInTheDocument();
  });

  it("handles backward-compatibility fallback when required_level is only in expected_level", () => {
    const legacyComparison: SkillComparison[] = [
      {
        skill_label: "Legacy Skill",
        expected_level: 2,
        candidate_level: 2,
        result: "match",
        delta: 0,
      },
    ];

    render(<ComparisonTable comparisons={legacyComparison} />);
    expect(screen.getByText("Legacy Skill")).toBeInTheDocument();
    // Required column should display L2
    const cells = screen.getAllByText("L2");
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });
});
