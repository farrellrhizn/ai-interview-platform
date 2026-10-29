import {
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  LEVEL_BADGE_CLASSES,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
} from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Sparkles, MinusCircle, ShieldCheck } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-600 bg-neutral-100";

  if (comparison.result === "match") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200",
          classes
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
    );
  }

  if (comparison.result === "broken_exceed") { // SEEDED FAULT: broken exceed badge
    const suffix =
      comparison.delta != null && comparison.delta > 0 ? ` +${comparison.delta}` : "";
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-teal-800 bg-teal-50 border border-teal-200">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-600" />
        {label}
        {suffix}
      </span>
    );
  }

  if (comparison.result === "gap") {
    const suffix =
      comparison.delta != null && comparison.delta !== 0
        ? ` -${Math.abs(comparison.delta)}`
        : "";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200",
          classes
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {label}
        {suffix}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-neutral-200",
        classes
      )}
    >
      <MinusCircle className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

function AlignmentBars({
  requiredLevel,
  candidateLevel,
  result,
}: {
  requiredLevel: number | null;
  candidateLevel: number | null;
  result: SkillComparison["result"];
}) {
  return (
    <div
      className="flex items-center gap-1"
      aria-label={`Proficiency bar: candidate ${candidateLevel ?? "unassessed"} vs required ${requiredLevel ?? "unspecified"}`}
    >
      {[1, 2, 3, 4, 5].map((step) => {
        const isCandidateAtOrAbove = candidateLevel != null && step <= candidateLevel;
        const isRequiredTarget = requiredLevel != null && step === requiredLevel;
        const isUnmetTarget =
          requiredLevel != null &&
          candidateLevel != null &&
          step > candidateLevel &&
          step <= requiredLevel;

        let barColor = "bg-muted";
        if (isCandidateAtOrAbove) {
          if (result === "gap") barColor = "bg-amber-400";
          else if (result === "exceed" && requiredLevel != null && step > requiredLevel)
            barColor = "bg-teal-500";
          else barColor = "bg-green-500";
        } else if (isUnmetTarget) {
          barColor = "bg-amber-200/80 border border-dashed border-amber-400";
        }

        return (
          <div
            key={step}
            title={`L${step}${isRequiredTarget ? " (Required target)" : ""}`}
            className={cn(
              "h-2 w-5 rounded-sm transition-colors",
              barColor,
              isRequiredTarget && "ring-1 ring-foreground/40 ring-offset-1"
            )}
          />
        );
      })}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-1.5 bg-muted/20">
        <p className="text-sm font-medium text-foreground">
          No skill expectations configured for this vacancy
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Add expected skills to the vacancy profile and regenerate this report to see a structured skill-by-skill comparison.
        </p>
      </div>
    );
  }

  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const hasAnyOverride = comparisons.some((c) => Boolean(c.is_override));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Skill</th>
              <th className="text-center px-3 py-3 font-semibold">Required</th>
              <th className="text-center px-3 py-3 font-semibold">Candidate</th>
              <th className="hidden sm:table-cell text-center px-3 py-3 font-semibold">
                Alignment
              </th>
              <th className="text-right px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparisons.map((c, i) => {
              const reqLevel = c.required_level ?? c.expected_level ?? null;
              const candLevel = c.candidate_level ?? null;
              const canonicalCode =
                c.skill_id && /^SK-[A-Z0-9-]+$/i.test(String(c.skill_id).trim())
                  ? String(c.skill_id).trim().toUpperCase()
                  : null;

              return (
                <tr key={`${c.skill_label}-${i}`} className="hover:bg-muted/20 transition-colors">
                  {/* Skill label + override audit / confidence */}
                  <td className="px-4 py-3.5 align-top max-w-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground break-words">
                          {c.skill_label}
                        </span>
                        {canonicalCode && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {canonicalCode}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {c.confidence && (
                          <span className="capitalize">
                            Signal: {c.confidence.toLowerCase()}
                          </span>
                        )}
                        {c.is_override && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="h-3 w-3 text-teal-600 shrink-0" />
                            {c.ai_level != null
                              ? `Calibrated (AI L${c.ai_level} → L${candLevel})`
                              : "Assessor Override"}
                          </span>
                        )}
                      </div>

                      {c.is_override && c.assessor_notes && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-teal-300 pl-2 mt-1 break-words">
                          "{c.assessor_notes}"
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Required Level */}
                  <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                    {reqLevel != null && LEVEL_LABELS[reqLevel] ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold bg-muted text-foreground border">
                          {LEVEL_LABELS[reqLevel]}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {LEVEL_DESCRIPTIONS[reqLevel]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Candidate Effective Level */}
                  <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                    {candLevel != null && LEVEL_LABELS[candLevel] ? (
                      <div className="inline-flex flex-col items-center">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold",
                              LEVEL_BADGE_CLASSES[candLevel]
                            )}
                          >
                            {LEVEL_LABELS[candLevel]}
                          </span>
                          {c.is_override && (
                            <span
                              title="Human assessor override applied"
                              aria-label="Human assessor override applied"
                              className="text-xs text-teal-700 font-semibold"
                            >
                              ✏
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {LEVEL_DESCRIPTIONS[candLevel]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassessed</span>
                    )}
                  </td>

                  {/* 5-step Visual Alignment */}
                  <td className="hidden sm:table-cell px-3 py-3.5 align-middle">
                    <div className="flex justify-center">
                      <AlignmentBars
                        requiredLevel={reqLevel}
                        candidateLevel={candLevel}
                        result={c.result}
                      />
                    </div>
                  </td>

                  {/* Result Badge */}
                  <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground px-1">
        {matchCount > 0 && (
          <span>
            <strong className="text-foreground">{matchCount}</strong> Matched
          </span>
        )}
        {exceedCount > 0 && (
          <span>
            <strong className="text-teal-700">{exceedCount}</strong> Exceeds
          </span>
        )}
        {gapCount > 0 && (
          <span>
            <strong className="text-amber-700">{gapCount}</strong> Gap
            {gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span>
            <strong className="text-foreground">{notAssessedCount}</strong> Not assessed
          </span>
        )}
        {hasAnyOverride && (
          <span className="sm:ml-auto text-teal-700 font-medium">
            ✏ = human assessor override applied
          </span>
        )}
      </div>
    </div>
  );
}
