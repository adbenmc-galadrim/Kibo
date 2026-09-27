import type { Ticket } from "@kibo/schema";
import { cloneElement, type ReactElement } from "react";
import { frPresence } from "../i18n/fr-presence";

type Props = { ticket: Pick<Ticket, "key">; children: ReactElement<{ disabled?: boolean }> };

export function KeyRequired({ ticket, children }: Props) {
  if (ticket.key !== null) return children;
  return (
    <span data-key-required title={frPresence.pendingKey} className="inline-flex w-fit">
      {cloneElement(children, { disabled: true })}
    </span>
  );
}
