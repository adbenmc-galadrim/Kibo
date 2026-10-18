import type { ProjectSnapshot, TicketView } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import type { ReactNode } from "react";
import { frTicketTracking as t } from "../i18n/fr-ticket-tracking";
import { headerContext } from "./tracking-model";

type Props = {
  project: Pick<ProjectSnapshot, "tickets" | "sprints">;
  ticket: TicketView;
  actions?: ReactNode;
};

export function TicketHeader({ project, ticket, actions }: Props) {
  const context = headerContext(ticket, project);
  return (
    <div className="flex min-h-6 items-center gap-2 text-xs">
      <TicketKeyLabel ticket={ticket} className="shrink-0 font-mono whitespace-nowrap text-foreground" />
      <p data-ticket-context className="min-w-0 truncate font-mono text-muted-foreground">
        {context.lead}
        {context.pr && (
          <>
            {context.lead && " · "}
            <a
              href={context.pr.url}
              target="_blank"
              rel="noreferrer noopener"
              title={t.openPr(context.pr.number)}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {t.pr(context.pr.number)}
            </a>
          </>
        )}
      </p>
      {actions && <span className="ml-auto flex shrink-0 items-center gap-2">{actions}</span>}
    </div>
  );
}
