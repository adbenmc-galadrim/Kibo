import type { TicketView } from "@kibo/schema";
import { Frame, PenTool } from "lucide-react";
import { frDesign } from "../../i18n/fr-design";
import { designRefs, refProvider } from "./design-refs";

export function DesignProperty({ ticket }: { ticket: TicketView }) {
  const first = designRefs(ticket)[0];
  if (!first) return null;
  const provider = refProvider(first);
  const Icon = provider === "figma" ? Frame : PenTool;
  return (
    <>
      <dt className="text-muted-foreground">{frDesign.sheet.mockupProperty}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <Icon role="img" aria-label={frDesign.provider[provider]} className="size-3 shrink-0" />
        <a
          className="truncate underline-offset-4 hover:underline"
          href={first.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {first.name}
        </a>
      </dd>
    </>
  );
}
