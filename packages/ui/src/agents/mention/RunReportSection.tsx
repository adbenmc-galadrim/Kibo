import type { RunReport } from "@kibo/schema";
import { frMoments } from "../../i18n/fr-moments";
import { ReportCard } from "../../moments/ReportCard";

type Props = { runId: string; report: RunReport | null };

export function RunReportSection({ runId, report }: Props) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">
        {frMoments.run.report(report !== null && report.runId !== runId)}
      </h3>
      <ReportCard report={report} />
    </div>
  );
}
