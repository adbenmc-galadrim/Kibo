import type { Overlap } from "@kibo/schema";
import { Users } from "lucide-react";
import { useId, useState } from "react";
import { frOverlaps } from "../i18n/fr-overlaps";
import { useOptionalHost } from "../shell/Host";
import { useNow } from "../state/use-agents";
import { OverlapFeedLayer } from "./OverlapFeedLayer";
import { ParallelRunCard } from "./ParallelRunCard";
import { useParallelWork } from "./use-parallel-work";

const t = frOverlaps.parallel;

const withRun = (overlaps: readonly Overlap[], runId: string): Overlap[] =>
  overlaps.filter((o) => o.ownerRunId === runId || o.otherRunId === runId);

export function ParallelWorkSection({ runId }: { runId: string }) {
  const heading = useId();
  const host = useOptionalHost();
  const now = useNow(60_000);
  const { work, error } = useParallelWork(runId);
  const [filesId, setFilesId] = useState<string | null>(null);
  return (
    <section aria-labelledby={heading} className="grid content-start gap-3">
      <div className="grid gap-0.5">
        <h3 id={heading} className="flex items-center gap-2 text-sm font-semibold">
          <Users aria-hidden className="size-4 text-muted-foreground" />
          {t.title}
          {work && work.runs.length > 0 && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {t.active(work.runs.length + work.more)}
            </span>
          )}
        </h3>
        <p className="text-xs text-muted-foreground">{t.hint}</p>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
      {work?.partial && <p className="text-xs text-muted-foreground">{t.partial}</p>}
      {work && work.runs.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
      {work && work.runs.length > 0 && (
        <ul className="grid gap-3">
          {work.runs.map((run) => (
            <ParallelRunCard
              key={run.runId}
              run={run}
              overlaps={withRun(work.overlaps, run.runId)}
              now={now}
              onSeeWork={(id) => host?.openRun?.(id)}
              onSeeFiles={setFilesId}
            />
          ))}
        </ul>
      )}
      {work && work.more > 0 && <p className="text-xs text-muted-foreground">{t.more(work.more)}</p>}
      <OverlapFeedLayer filesId={filesId} onClose={() => setFilesId(null)} />
    </section>
  );
}
