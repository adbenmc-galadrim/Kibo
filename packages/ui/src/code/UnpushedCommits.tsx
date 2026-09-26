import type { CommitInfo } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowUpFromLine, Pencil, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { fr } from "../i18n/fr";
import { RewordDialog } from "./RewordDialog";
import { UndoCommitDialog } from "./UndoCommitDialog";

const COMPACT = "h-7 px-2 text-xs has-[>svg]:px-2";

type Props = {
  commits: CommitInfo[];
  busy: boolean;
  onModify(commit: CommitInfo): void;
  onReword(commit: CommitInfo, message: string): Promise<void>;
  onUndo(commit: CommitInfo): Promise<void>;
};

export function UnpushedCommits({ commits, busy, onModify, onReword, onUndo }: Props) {
  const id = useId();
  const unpushed = commits.filter((c) => !c.pushed);
  const pushed = commits.filter((c) => c.pushed);
  const [rewording, setRewording] = useState<CommitInfo | null>(null);
  const [undoing, setUndoing] = useState<CommitInfo | null>(null);
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-2 border-t pt-4">
      <header className="flex items-center justify-between">
        <h3 id={id} className="text-xs font-semibold">
          {fr.commit.unpushed}
        </h3>
        <span
          className={cn(
            "font-mono text-2xs",
            unpushed.length > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
          )}
        >
          ↑{unpushed.length}
        </span>
      </header>
      <ul className="grid min-w-0 gap-2">
        {unpushed.map((c, i) => (
          <li key={c.sha} className="min-w-0 rounded-lg border p-3">
            <p className="flex min-w-0 items-center gap-2 text-xs">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-orange-500" />
              <span className="font-mono text-2xs text-muted-foreground">{c.shortSha}</span>
              <span className="truncate">{c.subject}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {i === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className={COMPACT}
                  disabled={busy}
                  onClick={() => onModify(c)}
                >
                  <Pencil />
                  {fr.commit.modify}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={COMPACT}
                disabled={busy}
                onClick={() => setRewording(c)}
              >
                {fr.commit.reword}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={COMPACT}
                disabled={busy}
                onClick={() => setUndoing(c)}
              >
                <Undo2 />
                {fr.commit.undo}
              </Button>
            </div>
          </li>
        ))}
        {pushed.map((c) => (
          <li
            key={c.sha}
            className="min-w-0 rounded-lg border p-3 text-muted-foreground dark:opacity-70"
            title={fr.commit.pushed}
          >
            <p className="flex min-w-0 items-center gap-2 text-xs">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="font-mono text-2xs">{c.shortSha}</span>
              <span className="truncate">{c.subject}</span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-2xs">
              <ArrowUpFromLine aria-hidden className="size-3.5" />
              {fr.commit.pushed}
            </p>
          </li>
        ))}
      </ul>
      {rewording && (
        <RewordDialog
          commit={rewording}
          onClose={() => setRewording(null)}
          onSubmit={(m) => onReword(rewording, m)}
        />
      )}
      {undoing && (
        <UndoCommitDialog
          commit={undoing}
          newer={unpushed.findIndex((c) => c.sha === undoing.sha)}
          onClose={() => setUndoing(null)}
          onConfirm={() => onUndo(undoing)}
        />
      )}
    </section>
  );
}
