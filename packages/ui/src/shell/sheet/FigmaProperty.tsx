import type { TicketView } from "@kibo/schema";
import { Frame } from "lucide-react";
import { frDesign } from "../../i18n/fr-design";
import { figmaRefs } from "./figma-refs";

export function FigmaProperty({ ticket }: { ticket: TicketView }) {
  const first = figmaRefs(ticket)[0];
  if (!first) return null;
  return (
    <>
      <dt className="text-muted-foreground">{frDesign.sheet.mockupProperty}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <Frame aria-hidden className="size-3 shrink-0" />
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
