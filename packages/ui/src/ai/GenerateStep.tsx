import type { ComponentDraft } from "@kibo/schema";
import { ReplyBox } from "../agents/ReplyBox";
import { RunJournal } from "../agents/RunJournal";
import { fr } from "../i18n/fr";
import { useAgents, useRunLog } from "../state/use-agents";
import { AttemptLine } from "./AttemptLine";
import { draftRelativeLog } from "./draft-log";

export function GenerateStep({ draft }: { draft: ComponentDraft }) {
  const agents = useAgents();
  const log = useRunLog(draft.runId);
  const run = agents?.runs.find((r) => r.id === draft.runId) ?? null;
  return (
    <div className="grid gap-3">
      <AttemptLine draft={draft} run={run} />
      {run && <RunJournal label={run.label} log={draftRelativeLog(log ?? [], draft.id)} files={null} />}
      {run?.state === "waiting_input" && <ReplyBox run={run} />}
      <p className="text-xs text-muted-foreground">{fr.ai.sandboxNote}</p>
    </div>
  );
}
