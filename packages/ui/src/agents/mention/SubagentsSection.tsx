import type { RunSubagent } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { frSubagents } from "../../i18n/fr-subagents";
import { SubagentState } from "../../moments/SubagentMoment";
import { useNow } from "../../state/use-agents";
import { formatClock } from "../format";

type Props = { subagents: readonly RunSubagent[]; failed: boolean; onSee(subagentId: string): void };

const t = frSubagents.section;

function stateText(s: RunSubagent, now: number): string {
  if (s.state === "failed") return frSubagents.failed;
  if (s.state === "running") return t.running(now - s.startedAt);
  return t.done((s.endedAt ?? now) - s.startedAt);
}

function Row({ subagent, now, onSee }: { subagent: RunSubagent; now: number; onSee(): void }) {
  return (
    <li className="grid gap-1 border-t pt-2 text-xs first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono font-semibold text-brand-strong dark:text-brand">
          {subagent.type}
        </span>
        <SubagentState subagent={subagent} text={stateText(subagent, now)} />
      </div>
      <p className="min-w-0 truncate text-sm">{subagent.description}</p>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex-1 font-mono">
          {`${formatClock(subagent.startedAt)} · ${frSubagents.actions(subagent.actions)}`}
        </span>
        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={onSee}>
          {t.see}
        </Button>
      </div>
    </li>
  );
}

export function SubagentsSection({ subagents, failed, onSee }: Props) {
  const now = useNow();
  const running = subagents.filter((s) => s.state === "running").length;
  return (
    <section aria-label={t.title} className="grid gap-3">
      <header className="flex items-center gap-2">
        <Bot aria-hidden className="size-4 text-brand-strong dark:text-brand" />
        <h3 className="flex-1 text-sm font-semibold">{t.title}</h3>
        <span className="text-xs text-muted-foreground">{t.short(subagents.length, running)}</span>
      </header>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t.failed}
        </p>
      )}
      <ul className="grid gap-2">
        {subagents.map((s) => (
          <Row key={s.id} subagent={s} now={now} onSee={() => onSee(s.id)} />
        ))}
      </ul>
    </section>
  );
}
