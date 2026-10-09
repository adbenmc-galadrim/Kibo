import type { ProjectAgentSession } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ArrowLeft, History } from "lucide-react";
import { frProjectAgent } from "../i18n/fr-project-agent";

type Props = { sessions: readonly ProjectAgentSession[]; onOpen(runId: string): void; onBack(): void };

const t = frProjectAgent.past;

const formatDate = (at: number): string =>
  new Date(at).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function PastSessions({ sessions, onOpen, onBack }: Props) {
  return (
    <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7" onClick={onBack}>
          <ArrowLeft />
          {t.back}
        </Button>
        <h3 className="text-sm font-medium">{t.title}</h3>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="grid gap-1">
          {sessions.map((s) => (
            <li key={s.runId}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 py-2 text-left font-normal"
                onClick={() => onOpen(s.runId)}
              >
                <History className="text-muted-foreground" />
                {t.item(formatDate(s.startedAt))}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PastBanner({ onBack }: { onBack(): void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
      <span>{t.banner}</span>
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onBack}>
        <ArrowLeft />
        {t.back}
      </Button>
    </div>
  );
}
