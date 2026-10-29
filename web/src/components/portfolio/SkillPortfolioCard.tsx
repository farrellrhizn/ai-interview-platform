import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { parseLevel, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const aiLevelNum = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevelNum;
  const canonicalSkillCode =
    skill.skill_id && !skill.is_discovered && /^SK-[A-Z0-9-]+$/i.test(String(skill.skill_id).trim())
      ? String(skill.skill_id).trim().toUpperCase()
      : null;

  return (
    <Card className={override ? "border-teal-200/80 shadow-sm" : "shadow-sm"}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-foreground break-words">
                  {skill.skill_label}
                </span>
                {canonicalSkillCode && (
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {canonicalSkillCode}
                  </span>
                )}
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>

          <div className="shrink-0">
            <OverridePanel
              skill={skill}
              existingOverride={override}
              onSaved={onOverrideSaved}
              open={editorOpen}
              onOpenChange={setEditorOpen}
              mode="trigger"
            />
          </div>
        </div>

        {/* Full-width Override Editor */}
        <OverridePanel
          skill={skill}
          existingOverride={override}
          onSaved={onOverrideSaved}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          mode="form"
        />

        {/* Visible Assessor Override Audit Callout (when closed) */}
        {override && !editorOpen && (
          <div className="rounded-lg bg-teal-50/60 border border-teal-200/80 px-3.5 py-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-900">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                Assessor Calibration: L{aiLevelNum} ({LEVEL_DESCRIPTIONS[aiLevelNum]}) → L{override.override_level} ({LEVEL_DESCRIPTIONS[override.override_level]})
              </span>
              {override.overridden_at && (
                <span className="text-[11px] text-teal-700/80">
                  Updated {new Date(override.overridden_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {override.assessor_notes ? (
              <p className="text-sm text-teal-950/90 leading-relaxed whitespace-pre-wrap break-words">
                "{override.assessor_notes}"
              </p>
            ) : (
              <p className="text-xs italic text-teal-800/70">
                No written rationale provided by assessor.
              </p>
            )}
          </div>
        )}

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Only briefly explored during the session. Confidence is low — warrants a dedicated follow-up probe if this skill is critical for the role.
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {/* Evidence */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <MessageSquareQuote className="h-3.5 w-3.5" />
            Evidence from interview
          </span>
          {skill.evidence && skill.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 py-0.5 italic break-words"
                >
                  "{quote}"
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No direct verbatim quotes were captured for this skill.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
