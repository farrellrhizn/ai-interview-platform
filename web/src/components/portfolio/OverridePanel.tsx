import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { Loader2, Pencil, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { parseLevel, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "trigger" | "form" | "inline";
}

export default function OverridePanel({
  skill,
  existingOverride,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  mode = "inline",
}: OverridePanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  const aiLevelNum = parseLevel(skill.ai_level);
  const [overrideLevel, setOverrideLevel] = useState(
    existingOverride?.override_level ?? aiLevelNum
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
      setNotes(existingOverride?.assessor_notes ?? "");
      setSaveError(false);
    }
  }, [isOpen, existingOverride, skill.ai_level]);

  const hasOverride = !!existingOverride;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const renderTrigger = () => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {hasOverride ? (
        <>
          <div className="inline-flex items-center gap-1.5 text-xs bg-teal-50 text-teal-800 border border-teal-200 rounded-md px-2.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span>AI L{aiLevelNum}</span>
            <span className="text-teal-500">→</span>
            <span className="font-semibold">L{existingOverride!.override_level}</span>
            <span className="text-teal-700 font-medium">Assessor Override</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setOpen(!isOpen)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            {isOpen ? "Close" : "Edit override"}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setOpen(!isOpen)}
        >
          Override rating
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 ml-1" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          )}
        </Button>
      )}
    </div>
  );

  const renderForm = () => (
    <div className="border border-primary/25 rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Assessor Rating Calibration
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adjust the AI-assigned level if interview evidence warrants a different proficiency rating.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <span>AI baseline:</span>
          <LevelBadge level={aiLevelNum} size="sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Your calibrated rating</Label>
          <span className="text-xs text-muted-foreground">
            Selected: <strong className="text-foreground">L{overrideLevel} ({LEVEL_DESCRIPTIONS[overrideLevel]})</strong>
          </span>
        </div>
        <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${skill.id}`} className="text-sm font-medium">
          Assessor rationale / notes <span className="text-xs font-normal text-muted-foreground">(recommended for hiring audit)</span>
        </Label>
        <Textarea
          id={`notes-${skill.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Explain why you calibrated this rating (e.g., strong architectural tradeoff explanation in turn #4)..."
          className="bg-background text-sm"
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          Failed to save override. Please check your connection and try again.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save override
        </Button>
      </div>
    </div>
  );

  if (mode === "trigger") return renderTrigger();
  if (mode === "form") return isOpen ? renderForm() : null;

  return (
    <div className="space-y-3">
      {renderTrigger()}
      {isOpen && renderForm()}
    </div>
  );
}
