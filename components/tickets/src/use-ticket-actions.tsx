import {
  KiboError,
  type ProjectCommand,
  type Status,
  type StatusId,
  type TicketRun,
  type TicketView,
} from "@kibo/schema";
import { deliverEntry, useDeliverFlow, useDeliveryAgentKnown, useReadOnly, useSdk } from "@kibo/sdk";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { type ReactNode, useState } from "react";
import { fr } from "./fr";
import { descendantCount, ticketMenuEntries } from "./ticket-menu";

export type TicketActions = {
  attempt(cmd: ProjectCommand, failure: string): Promise<boolean>;
  entriesFor(ticket: TicketView): MenuEntry[];
  error: string | null;
  dialogs: ReactNode;
};

export function useTicketActions(
  all: readonly TicketView[],
  runs: readonly TicketRun[],
  statuses: Status[],
): TicketActions {
  const sdk = useSdk();
  const readOnly = useReadOnly();
  const delivery = useDeliverFlow();
  const agentKnown = useDeliveryAgentKnown();
  const [blocking, setBlocking] = useState<TicketView | null>(null);
  const [removing, setRemoving] = useState<TicketView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attempt = async (cmd: ProjectCommand, failure: string): Promise<boolean> => {
    try {
      await sdk.run(cmd);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof KiboError && e.code === "TREE_CYCLE" ? fr.cycle : failure);
      return false;
    }
  };
  const setStatus = (t: TicketView, statusId: StatusId) => {
    if (statusId === "blocked") {
      setError(null);
      setBlocking(t);
    } else void attempt({ method: "setStatus", ticketId: t.id, statusId }, fr.statusFailed(t.keyLabel));
  };
  const entriesFor = (t: TicketView) =>
    ticketMenuEntries({
      ticket: t,
      statuses,
      readOnly,
      deliver: deliverEntry({
        ticket: t,
        editable: !readOnly,
        agentKnown,
        parent: all.some((x) => x.parentId === t.id),
        run: runs.find((r) => r.ticketId === t.id) ?? null,
      }),
      texts: fr,
      actions: {
        deliver: () => delivery.deliver(t),
        open: () => sdk.openTicket(t.id),
        setStatus: (statusId) => setStatus(t, statusId),
        newSubTicket: () => sdk.openNewTicket({ parentId: t.id }),
        moveToRoot: () =>
          void attempt({ method: "moveTicket", ticketId: t.id, parentId: null }, fr.moveFailed(t.keyLabel)),
        remove: () => setRemoving(t),
      },
    });

  const dialogs = (
    <>
      {blocking && (
        <ReasonDialog
          open
          title={fr.block.title(blocking.keyLabel)}
          description={fr.block.description}
          label={fr.block.reason}
          placeholder={fr.block.placeholder}
          confirmLabel={fr.block.confirm}
          cancelLabel={fr.block.cancel}
          error={error}
          onConfirm={(reason) =>
            void attempt(
              { method: "setStatus", ticketId: blocking.id, statusId: "blocked", reason },
              fr.statusFailed(blocking.keyLabel),
            ).then((ok) => ok && setBlocking(null))
          }
          onCancel={() => setBlocking(null)}
        />
      )}
      {delivery.dialog}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.keyLabel)}
          description={fr.removeHelp(descendantCount(all, removing.id))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={async () => {
            await sdk.run({ method: "deleteTicket", ticketId: removing.id });
          }}
        />
      )}
    </>
  );
  return { attempt, entriesFor, error: delivery.error ?? (error && !blocking ? error : null), dialogs };
}
