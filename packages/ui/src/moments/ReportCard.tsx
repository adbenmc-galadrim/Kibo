import type { RunReport } from "@kibo/schema";
import { frMoments } from "../i18n/fr-moments";

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <ul className="grid list-disc gap-0.5 pl-4 text-sm">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FileCheckLines({ report }: { report: RunReport }) {
  const t = frMoments.report;
  if (!report.check) return <p className="text-xs text-muted-foreground italic">{t.unchecked}</p>;
  const { undeclared, unchanged } = report.check;
  return (
    <>
      {undeclared.length > 0 && <p className="text-xs text-destructive">{t.undeclared(undeclared.length)}</p>}
      {unchanged.length > 0 && (
        <p className="text-xs text-muted-foreground">{t.unchanged(unchanged.length)}</p>
      )}
    </>
  );
}

export function ReportCard({ report }: { report: RunReport | null }) {
  const t = frMoments.report;
  if (!report) return <p className="text-sm text-muted-foreground">{t.none}</p>;
  return (
    <section aria-label={t.title} className="grid gap-3 rounded-md border p-3">
      <div className="grid gap-1">
        <h4 className="text-xs font-medium text-muted-foreground">{t.done}</h4>
        <p className="text-sm break-words">{report.done}</p>
      </div>
      <Section title={t.decisions} items={report.decisions} />
      <Section title={t.toCheck(report.toCheck.length)} items={report.toCheck} />
      <div className="grid gap-1">
        <Section title={t.files(report.files.length)} items={report.files} />
        <FileCheckLines report={report} />
      </div>
      {report.next && (
        <div className="grid gap-1">
          <h4 className="text-xs font-medium text-muted-foreground">{t.next}</h4>
          <p className="text-sm break-words">{report.next}</p>
        </div>
      )}
    </section>
  );
}
