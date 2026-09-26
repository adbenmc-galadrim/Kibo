import type { FileDiff } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { useState } from "react";
import { DiffView } from "../code/DiffView";
import { fr } from "../i18n/fr";

export function DraftDiffReview({ diff }: { diff: FileDiff[] }) {
  const [active, setActive] = useState(0);
  const current = diff[active];
  if (!current) return <p className="text-sm text-muted-foreground">{fr.ai.noChange}</p>;
  return (
    <div className="grid min-h-64 grid-cols-[11rem_1fr] gap-3">
      <ul aria-label={fr.ai.reviewTitle} className="grid content-start gap-1">
        {diff.map((d, i) => (
          <li key={d.path}>
            <button
              type="button"
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs hover:bg-accent/60",
                i === active && "bg-accent",
              )}
              onClick={() => setActive(i)}
            >
              <span className="min-w-0 flex-1 truncate">{d.path}</span>
              {d.additions > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">+{d.additions}</span>
              )}
              {d.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{d.deletions}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex max-h-96 min-w-0 overflow-auto rounded-md border">
        <DiffView
          diff={{ ...current, hunkStaging: false }}
          area="unstaged"
          mode="unified"
          busy={false}
          onHunk={() => {}}
        />
      </div>
    </div>
  );
}
