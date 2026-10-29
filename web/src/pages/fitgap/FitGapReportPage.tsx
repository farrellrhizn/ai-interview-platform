import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { parseLevel } from "@/utils/constants";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  Sparkles,
  Users,
  AlertTriangle,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import type { FitGapReport, Portfolio, Vacancy, AssessorOverride } from "@/types";

const MAX_POLL_ATTEMPTS = 18; // ~90s timeout ceiling at 5s interval

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Guard against duplicate background job enqueueing during polling
  const autoTriggeredRef = useRef(false);
  const pollCountRef = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
      pollCountRef.current = 0;
    } catch (e: any) {
      if (e?.response?.status === 404) {
        if (!autoTriggeredRef.current) {
          autoTriggeredRef.current = true;
          try {
            const triggerRes = await portfoliosApi.triggerFitGap(
              portfolio.id,
              Number(vacancyId)
            );
            const payload = triggerRes.data as any;
            if (payload?.report) {
              setReport(payload.report);
              setGenerating(false);
            } else {
              setGenerating(true);
            }
          } catch {
            setGenerating(false);
            setError("Failed to start Fit/Gap analysis. Please verify the vacancy exists and retry.");
          }
        } else {
          pollCountRef.current += 1;
          if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
            setGenerating(false);
            setError("Fit/Gap report generation timed out. The background worker may be busy — please click Regenerate to retry.");
          }
        }
      } else {
        setGenerating(false);
        setError("Unable to load Fit/Gap report. Please refresh or try regenerating.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    autoTriggeredRef.current = false;
    pollCountRef.current = 0;
    setLoading(true);
    setError(null);

    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)).catch(() => null),
      vacanciesApi.get(Number(vacancyId)).catch(() => null),
    ])
      .then(([pRes, sRes, vRes]) => {
        const data = pRes.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError("Candidate portfolio is not ready yet. Complete portfolio generation first.");
        }
        if (sRes?.data?.session) {
          setCandidateName(sRes.data.session.candidate_name ?? null);
        }
        if (vRes?.data?.vacancy) {
          setVacancy(vRes.data.vacancy);
        }
      })
      .catch(() => {
        setError("Failed to load candidate portfolio context.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setError(null);
    pollCountRef.current = 0;
    autoTriggeredRef.current = true;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      setError("Failed to queue Fit/Gap regeneration. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId)
      );
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(`Failed to export ${format.toUpperCase()} report. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const metrics = useMemo(() => {
    const comparisons = report?.skill_comparisons ?? [];
    const total = comparisons.length;
    const matchCount = comparisons.filter((c) => c.result === "match").length;
    const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
    const gapCount = comparisons.filter((c) => c.result === "gap").length;
    const notAssessed = comparisons.filter((c) => c.result === "not_assessed");
    const assessedCount = total - notAssessed.length;
    const metCount = matchCount + exceedCount;
    const readinessPct =
      assessedCount > 0 ? Math.round((metCount / assessedCount) * 100) : null;

    let readinessLabel = "Pending Coverage";
    let readinessTone = "text-muted-foreground";
    if (readinessPct !== null) {
      if (readinessPct >= 80 && gapCount === 0) {
        readinessLabel = "Strong Fit";
        readinessTone = "text-green-700";
      } else if (readinessPct >= 60) {
        readinessLabel = "Moderate Fit";
        readinessTone = "text-primary";
      } else {
        readinessLabel = "Gaps Identified";
        readinessTone = "text-amber-700";
      }
    }

    return {
      total,
      assessedCount,
      matchCount,
      exceedCount,
      gapCount,
      notAssessed,
      metCount,
      readinessPct,
      readinessLabel,
      readinessTone,
    };
  }, [report]);

  const overrideMap = useMemo(() => {
    const map: Record<number, AssessorOverride> = {};
    (portfolio?.overrides ?? []).forEach((o) => {
      map[o.portfolio_skill_id] = o;
    });
    return map;
  }, [portfolio]);

  const discoveredSkills = useMemo(
    () => (portfolio?.skills ?? []).filter((s) => s.is_discovered),
    [portfolio]
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Fit/Gap Report</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground/80">
                {candidateName || `Session #${sessionId}`}
              </span>
              {vacancy && (
                <>
                  <span>→</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    <Briefcase className="h-3.5 w-3.5" />
                    {vacancy.role_title}
                  </span>
                </>
              )}
              {report?.generated_at && (
                <>
                  <span>·</span>
                  <span className="text-xs">
                    Generated {new Date(report.generated_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Regenerate
            </Button>
            {report && (
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
        )}
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

      {/* Error state */}
      {error && !generating && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="h-7 w-7 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{error}</p>
          {portfolio && (
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Fit/Gap Analysis
            </Button>
          )}
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="border rounded-xl p-12 text-center space-y-3 bg-card shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating Fit/Gap report...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Comparing calibrated skill ratings against vacancy expectations and synthesizing hiring insights.
            </p>
          </div>
        </div>
      )}

      {/* Report ready */}
      {!generating && report && (
        <>
          {/* Executive Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-3.5">
                <div className="text-xs text-muted-foreground">Role Readiness</div>
                <div className={`text-2xl font-bold mt-1 ${metrics.readinessTone}`}>
                  {metrics.readinessPct !== null ? `${metrics.readinessPct}%` : "—"}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {metrics.readinessLabel}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3.5">
                <div className="text-xs text-muted-foreground">Requirements Met</div>
                <div className="text-2xl font-bold text-green-700 mt-1">
                  {metrics.metCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{metrics.assessedCount}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {metrics.matchCount} matched · {metrics.exceedCount} exceeded
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3.5">
                <div className="text-xs text-muted-foreground">Skill Gaps</div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    metrics.gapCount > 0 ? "text-amber-600" : "text-foreground"
                  }`}
                >
                  {metrics.gapCount}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {metrics.gapCount > 0 ? "Needs follow-up / ramp-up" : "Zero gaps on assessed"}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3.5">
                <div className="text-xs text-muted-foreground">Vacancy Coverage</div>
                <div className="text-2xl font-bold mt-1">
                  {metrics.assessedCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{metrics.total}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {metrics.notAssessed.length > 0
                    ? `${metrics.notAssessed.length} unassessed`
                    : "All role skills assessed"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unassessed skills callout (AC-3) */}
          {metrics.notAssessed.length > 0 && (
            <div className="flex items-start gap-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {metrics.notAssessed.length} required skill
                  {metrics.notAssessed.length !== 1 ? "s were" : " was"} not assessed in this session
                </p>
                <p className="text-amber-900/80">
                  Unassessed skills ({metrics.notAssessed.map((s) => s.skill_label).join(", ")}) are excluded from the Role Readiness percentage so candidates are not penalized for unprobed topics. Consider probing them in the next interview stage.
                </p>
              </div>
            </div>
          )}

          {/* Skill comparison table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Skill-by-Skill Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Dual Narrative Section: Overall Recommendation + Culture & Competency Fit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-primary/25 shadow-sm">
              <CardHeader className="pb-2.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                  <Sparkles className="h-4 w-4" />
                  Overall Hiring Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {report.overall_narrative ? (
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                    {report.overall_narrative}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    No overall recommendation summary generated for this report.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Culture &amp; Competency Alignment
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {report.culture_narrative ? (
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                    {report.culture_narrative}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    Culture alignment narrative unavailable (vacancy culture expectations may be empty or AI narrative fell back to rule-based summary).
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Discovered skills */}
          {discoveredSkills.length > 0 && (
            <>
              <Separator />
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Additive Discovered Skills (Outside Vacancy Requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5">
                  {discoveredSkills.map((s) => {
                    const effLevel =
                      overrideMap[s.id]?.override_level ?? parseLevel(s.ai_level);
                    return (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <LevelBadge level={effLevel} size="sm" />
                          <span className="font-medium break-words">{s.skill_label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {s.ai_confidence?.toLowerCase() === "low"
                            ? "Low confidence · additive signal"
                            : "Confirmed · additive capability"}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
