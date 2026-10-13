import type { MomentData, Overlap } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Copy, Eye } from "lucide-react";
import { formatClock } from "../agents/format";
import { Mention } from "../agents/mention/Mention";
import { frOverlaps } from "../i18n/fr-overlaps";
import { actorName, overlapRole, overlapSides, overlapState, overlapWhat } from "../overlaps/overlap-labels";
import { useAgentsState } from "../state/agents-context";

type Data = Extract<MomentData, { kind: "overlap" }>;

export type OverlapMomentProps = {
  data: Data;
  at: number;
  overlap: Overlap | null;
  canEdit: boolean;
  now?: number;
  onSeeFiles(id: string): void;
  onIgnore(id: string): void;
};

const t = frOverlaps.moment;
const CODE = "font-mono text-foreground";

function What({ data, overlap }: { data: Data; overlap: Overlap | null }) {
  if (!overlap) {
    const prefix = `${t.with} ${data.withRunName} : `;
    return <span>{data.summary.startsWith(prefix) ? data.summary.slice(prefix.length) : data.summary}</span>;
  }
  const what = overlapWhat(overlap.detail);
  return (
    <span>
      {what.code && <code className={CODE}>{what.code}</code>}
      {what.code ? ` ${what.text}` : what.text}
    </span>
  );
}

function Sides({ data, overlap, theirs }: { data: Data; overlap: Overlap; theirs: string }) {
  const sides = overlapSides(overlap.detail, data.role);
  return (
    <span className="min-w-0 truncate text-muted-foreground">
      <code className={CODE}>{sides.mine}</code> {t.mine} · <code className={CODE}>{sides.theirs}</code>{" "}
      {`(${theirs})`}
    </span>
  );
}

function StateText({ overlap, now }: { overlap: Overlap | null; now: number }) {
  if (!overlap) return <span className="text-muted-foreground">{t.loading}</span>;
  const text =
    overlap.status === "ignored" ? t.ignored(actorName(overlap.ignoredBy)) : overlapState(overlap, now);
  return (
    <span data-state={overlap.status} className="flex items-center gap-1.5">
      <span aria-hidden className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      {text}
    </span>
  );
}

export function OverlapMoment({
  data,
  at,
  overlap,
  canEdit,
  now = Date.now(),
  onSeeFiles,
  onIgnore,
}: OverlapMomentProps) {
  const agents = useAgentsState();
  const theirs = agents?.runs.find((r) => r.id === data.withRunId)?.ticketKey ?? data.withRunName;
  const ignorable = canEdit && overlap?.status === "open";
  return (
    <div data-overlap={data.overlapId} className="grid gap-1.5 rounded-md border bg-card px-3 py-2 text-xs">
      <p className="flex min-w-0 items-center gap-1.5">
        <Copy aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          {`${t.with} `}
          <Mention runId={data.withRunId} label={data.withRunName} className="underline underline-offset-2" />
          {" · "}
          <What data={data} overlap={overlap} />
        </span>
      </p>
      <p className="flex min-w-0 items-center gap-2 pl-5">
        {overlap ? <Sides data={data} overlap={overlap} theirs={theirs} /> : <span className="flex-1" />}
        <span className="ml-auto shrink-0 font-mono text-muted-foreground">{formatClock(at)}</span>
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2 pl-5">
        <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal text-muted-foreground">
          {overlapRole(data.role, data.withRunName)}
        </Badge>
        <StateText overlap={overlap} now={now} />
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSeeFiles(data.overlapId)}>
          <Eye aria-hidden />
          {t.seeFiles}
        </Button>
        {ignorable && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onIgnore(data.overlapId)}
          >
            {t.ignore}
          </Button>
        )}
      </div>
    </div>
  );
}
