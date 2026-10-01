import type { ComponentDraft } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { aiErrorMessage } from "./ai-error";
import { draftStep } from "./draft-flow";

const SHOWN = 3;
const t = frCreations.banner;

const isActive = (d: ComponentDraft) => d.status !== "done" && d.status !== "abandoned";

const stepOf = (d: ComponentDraft): string => {
  const step = draftStep(d);
  return fr.ai.stepLabel(step, fr.ai.steps[step - 1] ?? "");
};

type Props = { onResume(draftId: string): void; onOpenCreations?(): void };

export function ActiveDraftsBanner({ onResume, onOpenCreations }: Props) {
  const id = useId();
  const [drafts, setDrafts] = useState<ComponentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "listComponentDrafts" }).then(
      (list) => alive && setDrafts(list.filter(isActive)),
      (e: unknown) => alive && setError(aiErrorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (drafts.length === 0) return null;
  return (
    <section
      aria-label={t.title(drafts.length)}
      className="grid gap-1.5 rounded-md border bg-muted/40 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t.title(drafts.length)}</h3>
        {onOpenCreations && (
          <Button size="sm" variant="link" className="h-auto px-0" onClick={onOpenCreations}>
            {t.all}
          </Button>
        )}
      </div>
      <ul className="grid gap-1">
        {drafts.slice(0, SHOWN).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
            <span id={`${id}-${d.id}`} className="min-w-0 truncate text-muted-foreground">
              {t.line(d.title, stepOf(d))}
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-describedby={`${id}-${d.id}`}
              onClick={() => onResume(d.id)}
            >
              {t.resume}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
