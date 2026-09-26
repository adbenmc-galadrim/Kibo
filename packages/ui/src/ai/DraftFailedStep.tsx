import type { ComponentDraftDetails } from "@kibo/schema";
import { Alert, AlertTitle } from "@kibo/sdk/ui/alert";
import { Info, TriangleAlert } from "lucide-react";
import { fr } from "../i18n/fr";
import { useAgents } from "../state/use-agents";
import { AttemptLine } from "./AttemptLine";
import { ValidationReportView } from "./ValidationReportView";

export function DraftFailedStep({
  details,
  exhausted,
}: {
  details: ComponentDraftDetails;
  exhausted: boolean;
}) {
  const agents = useAgents();
  const run = agents?.runs.find((r) => r.id === details.runId) ?? null;
  return (
    <div className="grid gap-3">
      <AttemptLine draft={details} run={run} outcome={exhausted ? "failed" : undefined} />
      {details.failure?.detail && (
        <p className="font-mono text-xs text-muted-foreground">{details.failure.detail}</p>
      )}
      {details.report && <ValidationReportView report={details.report} />}
      {details.incidents.map((i) => (
        <Alert
          key={`${i.kind}:${i.path}`}
          className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        >
          <TriangleAlert aria-hidden />
          <AlertTitle>{fr.ai.incident[i.kind](i.path)}</AlertTitle>
        </Alert>
      ))}
      {exhausted && (
        <Alert className="bg-muted/40">
          <Info aria-hidden />
          <AlertTitle>{fr.ai.exhausted}</AlertTitle>
        </Alert>
      )}
    </div>
  );
}
