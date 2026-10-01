import { type RunView, runSubject } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { Input } from "@kibo/sdk/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { elapsed, formatDuration, formatTokens, runResultText } from "./format";
import { filterRuns, RUN_FILTERS, type RunFilter } from "./run-filter";

type Props = {
  runs: RunView[];
  positions: ReadonlyMap<string, number>;
  now: number;
  onOpenRun: (runId: string) => void;
};

const isRunFilter = (v: string): v is RunFilter => RUN_FILTERS.some((f) => f === v);

function HistoryRow({
  run,
  position,
  now,
  onOpenRun,
}: {
  run: RunView;
  position: number | null;
  now: number;
  onOpenRun: (runId: string) => void;
}) {
  const subject = runSubject(run);
  return (
    <TableRow aria-label={subject} className="relative cursor-pointer">
      <TableCell className="font-mono text-muted-foreground">
        <button
          type="button"
          aria-label={frAgentsPage.openRun(run.profileName, subject)}
          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          onClick={() => onOpenRun(run.id)}
        >
          {`#${run.seq}`}
        </button>
      </TableCell>
      <TableCell>{subject}</TableCell>
      <TableCell className="font-mono">{run.profileName}</TableCell>
      <TableCell className="font-mono">
        {run.startedAt === null ? "-" : formatDuration(elapsed(run, now))}
      </TableCell>
      <TableCell>{formatTokens(run.tokens)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <RunDot state={run.state} />
          {runResultText(run, position)}
        </span>
      </TableCell>
    </TableRow>
  );
}

export function RunHistory({ runs, positions, now, onOpenRun }: Props) {
  const [filter, setFilter] = useState<RunFilter>("all");
  const [query, setQuery] = useState("");
  const t = frAgentsPage.filters;
  const c = fr.agentsPage.columns;
  const shown = filterRuns(runs, filter, query);
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-md font-semibold">{fr.agentsPage.history}</h2>
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t.label}
          value={filter}
          onValueChange={(v) => isRunFilter(v) && setFilter(v)}
        >
          {RUN_FILTERS.map((f) => (
            <ToggleGroupItem key={f} value={f} className="px-2.5 text-xs">
              {t[f]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input
          type="search"
          aria-label={frAgentsPage.searchKey}
          placeholder={frAgentsPage.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-40"
        />
      </div>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.agentsPage.noRuns}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{frAgentsPage.noMatch}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{c.run}</TableHead>
                <TableHead>{c.ticket}</TableHead>
                <TableHead>{c.profile}</TableHead>
                <TableHead>{c.duration}</TableHead>
                <TableHead>{c.tokens}</TableHead>
                <TableHead>{c.result}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <HistoryRow
                  key={r.id}
                  run={r}
                  position={positions.get(r.id) ?? null}
                  now={now}
                  onOpenRun={onOpenRun}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
