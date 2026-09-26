import type { DraftSummary } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Blocks } from "lucide-react";
import { fr } from "../i18n/fr";
import { VersionPill } from "./CatalogRow";

export function DraftRow({
  draft,
  onPublish,
}: {
  draft: DraftSummary;
  onPublish: ((id: string) => void) | undefined;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed px-2 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
        <Blocks aria-hidden className="size-4" />
      </span>
      <span className="flex flex-1 items-center gap-2 text-sm font-medium">
        {draft.title}
        <Badge variant="secondary">{fr.addComponent.draft}</Badge>
      </span>
      {onPublish ? (
        <Button size="sm" variant="outline" onClick={() => onPublish(draft.id)}>
          {fr.addComponent.publish}
        </Button>
      ) : (
        <VersionPill version={draft.version} />
      )}
    </div>
  );
}
