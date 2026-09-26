import type { CiJobSummary, CiRun } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { conclusionLabel, latestPerWorkflow, type RunTone, runDuration, runTone } from "./ci-format";

const t = fr.integrations.sheet;
const DOT: Record<RunTone, string> = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  running: "bg-amber-500",
  neutral: "bg-zinc-400",
};
const CiLogSheet = lazyPanel(() => import("./CiLogSheet").then((m) => m.CiLogSheet), fr.lazy, {
  fallback: "sr-only",
});

function RunRow({ run, onOpen }: { run: CiRun; onOpen(job: CiJobSummary): void }) {
  const job = run.jobs.find((j) => j.conclusion === "failure") ?? run.jobs[0];
  const duration = runDuration(run);
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[runTone(run)]}`} />
      <span className="font-medium">{run.workflow}</span>
      <span className="text-muted-foreground">{conclusionLabel(run)}</span>
      {duration && <span className="text-muted-foreground">{duration}</span>}
      {job && (
        <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={() => onOpen(job)}>
          {t.viewLogs}
        </Button>
      )}
    </div>
  );
}

export function CiSection({ projectId, ticketId }: { projectId: string; ticketId: string }) {
  const [runs, setRuns] = useState<CiRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ run: CiRun; job: CiJobSummary } | null>(null);
  const load = useCallback(async () => {
    try {
      setRuns(await client.rpc({ method: "listCiRuns", projectId, ticketId }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, ticketId]);
  useEffect(() => {
    void load();
    return client.subscribeIntegrations((e) => {
      if (e.type === "ci" && e.projectId === projectId) void load();
    });
  }, [projectId, load]);
  if (runs === null && !error) return null;
  return (
    <section className="grid gap-2 px-4 text-xs">
      <h3 className="font-medium">{t.ci}</h3>
      {error && <p className="text-destructive">{error}</p>}
      {runs?.length === 0 && <p className="text-muted-foreground">{t.ciEmpty}</p>}
      {latestPerWorkflow(runs ?? []).map((run) => (
        <RunRow key={run.runId} run={run} onOpen={(job) => setOpen({ run, job })} />
      ))}
      {open && (
        <CiLogSheet projectId={projectId} run={open.run} job={open.job} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
