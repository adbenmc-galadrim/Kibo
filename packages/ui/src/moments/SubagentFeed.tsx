import type { FileRef, RunSubagent } from "@kibo/schema";
import { frMoments } from "../i18n/fr-moments";
import { frSubagents } from "../i18n/fr-subagents";
import { Feed } from "./Feed";
import type { FileContext } from "./file-context";
import { useSubagentMoments } from "./use-subagent-moments";

type Props = {
  subagent: RunSubagent;
  subagents: ReadonlyMap<string, RunSubagent>;
  now: number;
  files?: FileContext | null;
  onOpenFile?(ref: FileRef): void;
};

export function SubagentFeed({ subagent, subagents, now, files, onOpenFile }: Props) {
  const t = frSubagents.nested;
  const { moments, loading, failed } = useSubagentMoments(subagent.runId, subagent.id);
  return (
    <section aria-label={t.label(subagent.type)} className="grid gap-2 border-l-2 pl-3">
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground">{t.loading}</p>
      ) : (
        <Feed
          moments={moments}
          subagentId={subagent.id}
          subagents={subagents}
          now={now}
          files={files}
          onOpenFile={onOpenFile}
          texts={{ ...frMoments, empty: t.empty }}
        />
      )}
    </section>
  );
}
