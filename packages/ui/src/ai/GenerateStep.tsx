import type { ComponentDraft } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { ReplyBox } from "../agents/ReplyBox";
import { RunJournal } from "../agents/RunJournal";
import { fr } from "../i18n/fr";
import { useAgents, useRunLog } from "../state/use-agents";

export function GenerateStep({ draft }: { draft: ComponentDraft }) {
  const agents = useAgents();
  const log = useRunLog(draft.runId);
  const run = agents?.runs.find((r) => r.id === draft.runId) ?? null;
  const details = run ? [run.profileName, fr.agents.states[run.state]].filter(Boolean) : [];
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {run && <RunDot state={run.state} />}
        <span>{fr.ai.attempt(draft.attempts)}</span>
        {details.map((d) => (
          <span key={d}>· {d}</span>
        ))}
      </p>
      {run && <RunJournal label={run.label} log={log ?? []} files={null} />}
      {run?.state === "waiting_input" && <ReplyBox run={run} />}
    </div>
  );
}
