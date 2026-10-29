import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Mic, UserCheck, Lock, ArrowRight } from "lucide-react";

interface CandidateConsentCardProps {
  roleTitle?: string;
  timeLimitMin?: number;
  onConsentAccepted: () => void;
}

export default function CandidateConsentCard({
  roleTitle,
  timeLimitMin,
  onConsentAccepted,
}: CandidateConsentCardProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Card className="border-primary/25 shadow-sm overflow-hidden">
      <div className="bg-primary/[0.06] border-b border-primary/15 px-5 py-3.5 flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Privacy &amp; AI Voice Assessment Notice
          </h2>
          <p className="text-xs text-muted-foreground">
            Informed consent in accordance with Indonesia&apos;s Personal Data Protection Law (UU PDP No. 27/2022)
          </p>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before checking your microphone or starting the{" "}
          <strong className="text-foreground">{roleTitle || "skills assessment"}</strong>{" "}
          session{timeLimitMin ? ` (up to ${timeLimitMin} minutes)` : ""}, please review how your data is processed:
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Mic className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-medium text-foreground text-xs uppercase tracking-wide">
                1. Real-Time Voice &amp; Transcript Processing
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your microphone audio is streamed securely during the session to conduct a live voice conversation and generate a text transcript of your responses. No camera or screen recording is captured unless explicitly enabled.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <UserCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-medium text-foreground text-xs uppercase tracking-wide">
                2. AI-Assisted Evaluation with Human Review
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An AI interviewer probes job-relevant skills and summarizes behavioral evidence. Human assessors can inspect the full transcript and calibrate or override any AI-proposed rating.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-medium text-foreground text-xs uppercase tracking-wide">
                3. Purpose Limitation &amp; Candidate Rights (UU PDP)
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your assessment data is shared solely with the hiring organization for recruitment evaluation. You may stop and exit the interview at any time, or contact the recruitment team to request access, correction, or deletion of your personal data.
              </p>
            </div>
          </div>
        </div>

        <label
          htmlFor="uupdp-consent-checkbox"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/[0.03] p-3.5 cursor-pointer select-none"
        >
          <input
            id="uupdp-consent-checkbox"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-teal-700 cursor-pointer"
          />
          <span className="text-xs text-foreground leading-relaxed">
            I have read and understood the Privacy &amp; AI Voice Assessment Notice, and I{" "}
            <strong>explicitly consent</strong> to the processing of my voice responses and interview transcript for this recruitment assessment.
          </span>
        </label>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            disabled={!agreed}
            onClick={onConsentAccepted}
            className="w-full sm:w-auto"
          >
            Agree &amp; Continue to Device Check
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
