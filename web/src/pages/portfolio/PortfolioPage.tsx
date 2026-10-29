import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { parseLevel, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  AlertCircle,
  Briefcase,
  Clock,
  Plus,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

function formatDuration(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (
      data.status === "generating" ||
      data.portfolio?.generation_status === "generating" ||
      data.portfolio?.generation_status === "pending"
    ) {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      const overrideMap: Record<number, AssessorOverride> = {};
      (data.portfolio.overrides ?? []).forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  const loadAll = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vRes, sRes]) => {
        const list = vRes.data.vacancies ?? [];
        setVacancies(list);
        if (list.length === 1) {
          setSelectedVacancy(String(list[0].id));
        }
        const sessionData = sRes.data.session as any;
        setCandidateName(sessionData.candidate_name ?? null);
        setDurationSeconds(sessionData.duration_seconds ?? null);
        setAssessmentName(sessionData.assessment?.name ?? null);
      })
      .catch(() => {
        setLoadError("Unable to load portfolio data. Please verify the session exists and try again.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll while generating
  usePolling(
    useCallback(async () => {
      try {
        await fetchPortfolio();
      } catch {
        // transient poll error — retry next cycle
      }
    }, [fetchPortfolio]),
    5000,
    generating
  );

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setExportError(`Failed to export ${format.toUpperCase()} file. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const configuredSkills = useMemo(
    () => (portfolio?.skills ?? []).filter((s) => !s.is_discovered),
    [portfolio]
  );
  const discoveredSkills = useMemo(
    () => (portfolio?.skills ?? []).filter((s) => s.is_discovered),
    [portfolio]
  );

  const summaryStats = useMemo(() => {
    const allSkills = portfolio?.skills ?? [];
    if (allSkills.length === 0) {
      return { avgLevel: 0, roundedLevel: 1, confidentCount: 0, overrideCount: 0 };
    }
    const totalLevel = allSkills.reduce((acc, s) => {
      const eff = overrides[s.id]?.override_level ?? parseLevel(s.ai_level);
      return acc + eff;
    }, 0);
    const avg = totalLevel / allSkills.length;
    const confidentCount = allSkills.filter((s) => {
      const c = s.ai_confidence?.toLowerCase();
      return c === "high" || c === "medium";
    }).length;
    const overrideCount = allSkills.filter((s) => Boolean(overrides[s.id])).length;

    return {
      avgLevel: Math.round(avg * 10) / 10,
      roundedLevel: Math.min(5, Math.max(1, Math.round(avg))),
      confidentCount,
      overrideCount,
    };
  }, [portfolio, overrides]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-6 text-center space-y-3">
          <AlertCircle className="h-7 w-7 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{loadError}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/invite`)}>
              Back to Sessions
            </Button>
            <Button size="sm" onClick={loadAll}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const formattedDuration = formatDuration(durationSeconds);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Link
            to={`/assessments/${id}/invite`}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Portfolio Results</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground/80">
                {candidateName || `Session #${sessionId}`}
              </span>
              {assessmentName && (
                <>
                  <span>·</span>
                  <span>{assessmentName}</span>
                </>
              )}
              {formattedDuration && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {formattedDuration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            state={{ from: `/assessments/${id}/sessions/${sessionId}/portfolio` }}
            className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-md px-3 h-8 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio?.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div className="flex items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 rounded-lg px-4 py-2.5 text-xs text-destructive">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border rounded-xl p-12 text-center space-y-3 bg-card shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating candidate skill portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing behavioral evidence across the interview transcript. This usually takes 15–60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="h-7 w-7 text-destructive mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">Portfolio generation failed</p>
            {portfolio.generation_error && (
              <p className="text-xs text-muted-foreground max-w-md mx-auto break-words">
                {portfolio.generation_error}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Generation
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Portfolio Overview Metrics */}
          {portfolio.skills.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="shadow-sm">
                <CardContent className="p-3.5">
                  <div className="text-xs text-muted-foreground">Assessed Skills</div>
                  <div className="text-xl font-bold mt-1">{configuredSkills.length}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {discoveredSkills.length > 0
                      ? `+${discoveredSkills.length} discovered`
                      : "All agenda skills"}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-3.5">
                  <div className="text-xs text-muted-foreground">Avg. Effective Level</div>
                  <div className="text-xl font-bold text-primary mt-1">
                    L{summaryStats.avgLevel}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {LEVEL_DESCRIPTIONS[summaryStats.roundedLevel]} tier
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-3.5">
                  <div className="text-xs text-muted-foreground">Signal Confidence</div>
                  <div className="text-xl font-bold mt-1">
                    {summaryStats.confidentCount}/{portfolio.skills.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Medium or high signal
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-3.5">
                  <div className="text-xs text-muted-foreground">Human Overrides</div>
                  <div className="text-xl font-bold mt-1">
                    {summaryStats.overrideCount}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {summaryStats.overrideCount > 0 ? "Calibrated by assessor" : "AI baseline active"}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty skills edge case */}
          {portfolio.skills.length === 0 ? (
            <div className="border rounded-xl p-8 text-center space-y-2 bg-muted/20">
              <p className="text-sm font-medium">No skill ratings were extracted</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                The interview may have ended before sufficient candidate responses were captured. Check the transcript for details.
              </p>
            </div>
          ) : (
            <>
              {/* Configured skills */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Configured Skills ({configuredSkills.length})
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Overrides automatically sync to Fit/Gap reports
                  </span>
                </div>
                {configuredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
              </div>

              {/* Discovered skills */}
              {discoveredSkills.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-sm font-semibold flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Discovered Skills ({discoveredSkills.length})
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Additional capabilities surfaced organically outside the configured agenda
                      </p>
                    </div>
                    {discoveredSkills.map((skill) => (
                      <SkillPortfolioCard
                        key={skill.id}
                        skill={skill}
                        override={overrides[skill.id]}
                        onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <Separator />

          {/* Fit/Gap Launcher Card */}
          <Card className="border-primary/25 bg-primary/[0.03] shadow-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Compare Against a Job Vacancy
                </div>
                <p className="text-xs text-muted-foreground">
                  Evaluate role readiness, skill gaps, and culture alignment using effective ratings.
                </p>
              </div>

              {vacancies.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/vacancies/new")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create a Vacancy First
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                    <SelectTrigger className="w-56 bg-background">
                      <SelectValue placeholder="Choose vacancy..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vacancies.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.role_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
                    Run Fit/Gap Analysis →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
