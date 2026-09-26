import type { DraftSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { fr } from "../i18n/fr";

type Props = { drafts: DraftSummary[]; onPublish(id: string): void };

function DraftState({ draft, onPublish }: { draft: DraftSummary; onPublish(id: string): void }) {
  const c = fr.components;
  if (!draft.validated)
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {c.draftPending(draft.id)}
      </span>
    );
  return (
    <>
      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
        {c.draftValidated}
      </span>
      <Button size="sm" variant="outline" className="h-7" onClick={() => onPublish(draft.id)}>
        {c.publish}
      </Button>
    </>
  );
}

export function DraftsSection({ drafts, onPublish }: Props) {
  if (drafts.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">{fr.components.drafts}</h2>
      <ul className="divide-y rounded-lg border">
        {drafts.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className="flex-1 font-medium">{d.title}</span>
            <span className="font-mono text-xs text-muted-foreground">{d.version}</span>
            <DraftState draft={d} onPublish={onPublish} />
          </li>
        ))}
      </ul>
    </section>
  );
}
