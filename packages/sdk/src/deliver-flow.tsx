import { type DeliveryKind, KiboError, type TicketView } from "@kibo/schema";
import { type ComponentType, type ReactNode, useState } from "react";
import type { DeliverChildrenProps } from "./deliver-children";
import { deliveryTexts } from "./fr-delivery";
import { lazyPanel } from "./lazy";
import { useSdk } from "./react";

let loaded: ComponentType<DeliverChildrenProps> | null = null;
const deliverChildren = (): ComponentType<DeliverChildrenProps> => {
  loaded ??= lazyPanel(
    () => import("./deliver-children").then((m) => m.DeliverChildren),
    deliveryTexts.lazy,
    {
      fallback: "sr-only",
    },
  );
  return loaded;
};

type Target = Pick<TicketView, "id" | "keyLabel" | "title">;
type Children = { parent: Target; items: DeliverChildrenProps["items"] };

export type DeliverFlow = {
  deliver(ticket: Target, mode?: DeliveryKind): void;
  error: string | null;
  dialog: ReactNode;
};

export function deliverError(error: unknown): string {
  if (!(error instanceof KiboError)) return deliveryTexts.notStarted;
  if (error.code === "AGENT_NOT_FOUND") return deliveryTexts.noAgent;
  if (error.code === "TICKET_HAS_CHILDREN") return deliveryTexts.parentTicket;
  return deliveryTexts.notStarted;
}

export function useDeliverFlow(): DeliverFlow {
  const sdk = useSdk();
  const [children, setChildren] = useState<Children | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deliver = (ticket: Target, mode?: DeliveryKind) => {
    setError(null);
    sdk.runs.deliver(ticket.id, mode).then(
      (result) => {
        if (result.kind === "parent") setChildren({ parent: ticket, items: result.items });
      },
      (e: unknown) => setError(deliveryTexts.failed(ticket.keyLabel, deliverError(e))),
    );
  };
  const DeliverChildren = deliverChildren();
  const dialog = children && (
    <DeliverChildren
      parent={children.parent}
      items={children.items}
      onDeliver={(ticketId) => sdk.runs.deliver(ticketId)}
      describeError={deliverError}
      onClose={() => setChildren(null)}
    />
  );
  return { deliver, error, dialog };
}
