import type { Page } from "@kibo/schema";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { componentIcon } from "../registry";
import { ComponentPreview } from "./ComponentPreview";
import type { Choice } from "./catalog-choices";
import { Segment } from "./Segment";

export function Details({ choice, page, source }: { choice: Choice; page: Page; source: ReactNode }) {
  const a = fr.addComponent;
  return (
    <>
      <ComponentPreview id={choice.id} icon={componentIcon(choice.ref)} />
      <div className="grid gap-1">
        <p className="text-base font-semibold">{choice.title}</p>
        {choice.description && <p className="text-muted-foreground">{choice.description}</p>}
      </div>
      <div className="grid gap-2">
        <p className="font-medium">{a.display}</p>
        <Segment
          value={page.kind}
          options={[{ value: page.kind, label: page.kind === "dashboard" ? a.widget : a.view }]}
        />
      </div>
      {source}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check aria-hidden className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
        {choice.line}
      </p>
    </>
  );
}
