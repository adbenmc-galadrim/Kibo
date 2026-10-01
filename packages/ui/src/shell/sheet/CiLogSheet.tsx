import type { CiJobSummary, CiLog, CiRun } from "@kibo/schema";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Switch } from "@kibo/sdk/ui/switch";
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { failureText } from "../../lib/remote-error";
import { visibleLines } from "./log-lines";

const t = fr.integrations.sheet;
const subtitleOf = (run: CiRun) => [
  run.workflow,
  ...(run.prNumber === null ? [] : [t.ciPr([run.prNumber])]),
  ...(run.ticketKey === null ? [] : [run.ticketKey]),
];
type Props = { projectId: string; run: CiRun; job: CiJobSummary; onClose(): void };

export function CiLogSheet({ projectId, run, job, onClose }: Props) {
  const [log, setLog] = useState<CiLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const searchId = useId();
  const errorsId = useId();
  useEffect(() => {
    let live = true;
    client
      .rpc({ method: "getCiLog", projectId, runId: run.runId, jobId: job.jobId })
      .then((l) => {
        if (live) setLog(l);
      })
      .catch((e: unknown) => {
        if (live) setError(failureText(e));
      });
    return () => {
      live = false;
    };
  }, [projectId, run.runId, job.jobId]);
  const lines = log ? visibleLines(log, query, errorsOnly) : [];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[min(90vw,720px)]">
        <SheetHeader>
          <SheetTitle>{t.logTitle(job.name)}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{t.logSubtitle(subtitleOf(run))}</SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-4 px-4">
          <Label htmlFor={searchId} className="sr-only">
            {t.logSearch}
          </Label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              placeholder={t.logSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch id={errorsId} checked={errorsOnly} onCheckedChange={setErrorsOnly} />
            <Label htmlFor={errorsId}>{t.errorsOnly}</Label>
          </div>
        </div>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        {log?.truncated && <p className="px-4 text-xs text-muted-foreground">{t.logTruncated}</p>}
        <pre className="mx-4 mb-4 flex-1 overflow-auto rounded-md border bg-muted/40 py-2 font-mono text-xs">
          {log && lines.length === 0 && <span className="px-3 text-muted-foreground">{t.logEmpty}</span>}
          {lines.map((l) => (
            <div
              key={l.n}
              className={`flex gap-3 px-3 ${l.error ? "bg-destructive/10 text-destructive" : ""}`}
            >
              <span aria-hidden className="w-10 shrink-0 select-none text-right text-muted-foreground">
                {l.n}
              </span>
              <span className="whitespace-pre-wrap break-all">{l.text}</span>
            </div>
          ))}
        </pre>
      </SheetContent>
    </Sheet>
  );
}
