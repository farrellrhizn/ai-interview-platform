import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";


interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
  excludeLabels?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  soft_skills: "Soft Skills",
  product_process: "Product & Process",
};

export default function SkillPicker({
  open,
  onOpenChange,
  onSelect,
  excludeLabels = [],
}: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch((err) => { console.error("skill_taxonomies fetch failed:", err); setSkills([]); })
      .finally(() => setLoading(false));
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const excludedSet = new Set(excludeLabels.map((l) => l.trim().toLowerCase()));

  const filtered = skills.filter(
    (s) =>
      s.skill_label.toLowerCase().includes(normalizedQuery) ||
      s.skill_id.toLowerCase().includes(normalizedQuery) ||
      s.category.toLowerCase().includes(normalizedQuery)
  );

  const handleSelect = (s: SkillTaxonomy) => {
    onSelect({
      skill_id: s.skill_id,
      skill_label: s.skill_label,
      is_custom: false,
      expected_level: 3,
      scope_include: s.scope_include,
      scope_exclude: s.scope_exclude,
      l1_anchor: s.l1_anchor,
      l2_anchor: s.l2_anchor,
      l3_anchor: s.l3_anchor,
      l4_anchor: s.l4_anchor,
      l5_anchor: s.l5_anchor,
    });
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add from Skill Taxonomy</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by skill name, ID (e.g. SK-ENG-001), or category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="mt-2 max-h-72 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            filtered.map((s) => {
              const alreadyAdded = excludedSet.has(s.skill_label.trim().toLowerCase());
              return (
                <button
                  key={s.skill_id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.skill_label}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono">{s.skill_id}</span>
                      <span>·</span>
                      <span>{CATEGORY_LABELS[s.category] ?? s.category}</span>
                    </div>
                  </div>
                  {alreadyAdded && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                      Added
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
