import type { ChangeArea, DiffLine, FileDiff, Hunk } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { memo } from "react";
import { fr } from "../i18n/fr";
import { splitRows } from "./diff-rows";

export type DiffMode = "unified" | "split";

const LINE_HEIGHT_PX = 24;
const GUTTER = "select-none pr-3 text-right text-zinc-600 dark:text-zinc-400";
const CODE = "min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]";
const TONE: Record<DiffLine["kind"], string> = {
  add: "bg-green-500/10 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  del: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  context: "",
};
const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "-", context: "" };

const lineKey = (l: DiffLine) => `${l.kind}:${l.oldNo ?? ""}:${l.newNo ?? ""}`;

const UnifiedHunk = memo(function UnifiedHunk({ hunk }: { hunk: Hunk }) {
  return (
    <div>
      {hunk.lines.map((l) => (
        <div key={lineKey(l)} className={cn("grid grid-cols-[3.5rem_3.5rem_1.5rem_1fr]", TONE[l.kind])}>
          <span className={GUTTER}>{l.oldNo ?? ""}</span>
          <span className={GUTTER}>{l.newNo ?? ""}</span>
          <span className="select-none">{SIGN[l.kind]}</span>
          <span className={CODE}>{l.text}</span>
        </div>
      ))}
    </div>
  );
});

function Half({ line, side }: { line: DiffLine | null; side: "old" | "new" }) {
  if (!line) return <div className="bg-muted/40" />;
  const no = side === "old" ? line.oldNo : line.newNo;
  return (
    <div className={cn("grid min-w-0 grid-cols-[3.5rem_1.5rem_1fr]", TONE[line.kind])}>
      <span className={GUTTER}>{no ?? ""}</span>
      <span className="select-none">{SIGN[line.kind]}</span>
      <span className={CODE}>{line.text}</span>
    </div>
  );
}

const SplitHunk = memo(function SplitHunk({ hunk }: { hunk: Hunk }) {
  return (
    <div>
      {splitRows(hunk).map((r) => (
        <div
          key={`${r.left ? lineKey(r.left) : "-"}|${r.right ? lineKey(r.right) : "-"}`}
          className="grid grid-cols-2 divide-x"
        >
          <Half line={r.left} side="old" />
          <Half line={r.right} side="new" />
        </div>
      ))}
    </div>
  );
});

type Props = {
  diff: FileDiff;
  area: ChangeArea;
  mode: DiffMode;
  busy: boolean;
  onHunk?: (index: number, header: string) => void;
};

export function DiffView({ diff, area, mode, busy, onHunk }: Props) {
  if (diff.binary) return <p className="p-6 text-sm text-muted-foreground">{fr.changes.binary}</p>;
  const label = area === "unstaged" ? fr.changes.stageHunk : fr.changes.unstageHunk;
  return (
    <div className="min-w-0 flex-1 overflow-auto font-mono text-xs leading-6">
      {diff.hunks.map((hunk, index) => (
        <section
          key={hunk.header}
          aria-label={hunk.header}
          style={{
            contentVisibility: "auto",
            containIntrinsicSize: `auto ${(hunk.lines.length + 1) * LINE_HEIGHT_PX}px`,
          }}
        >
          <header className="sticky top-0 z-10 flex h-7 items-center justify-between gap-4 bg-muted px-4 text-2xs text-zinc-600 dark:text-zinc-400">
            <span className="truncate">{hunk.header}</span>
            {diff.hunkStaging && onHunk && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-2xs"
                disabled={busy}
                onClick={() => onHunk(index, hunk.header)}
              >
                {label}
              </Button>
            )}
          </header>
          {mode === "unified" ? <UnifiedHunk hunk={hunk} /> : <SplitHunk hunk={hunk} />}
        </section>
      ))}
    </div>
  );
}
