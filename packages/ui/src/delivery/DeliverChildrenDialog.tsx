import type { DeliveryItem } from "@kibo/schema";
import { deliverError } from "@kibo/sdk";
import { DeliverChildren } from "@kibo/sdk/deliver-children";
import { client } from "../api";

type Props = {
  projectId: string;
  parent: { keyLabel: string; title: string };
  items: readonly DeliveryItem[];
  onClose(): void;
};

export function DeliverChildrenDialog({ projectId, parent, items, onClose }: Props) {
  return (
    <DeliverChildren
      parent={parent}
      items={items}
      onDeliver={(ticketId) => client.rpc({ method: "deliver", projectId, ticketId })}
      describeError={deliverError}
      onClose={onClose}
    />
  );
}
