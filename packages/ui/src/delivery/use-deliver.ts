import {
  DeliveryAgent,
  type DeliveryItem,
  deliveryOrder,
  deliveryTicketsOf,
  isTerminal,
  type ProjectSnapshot,
  type RunView,
  type TicketView,
} from "@kibo/schema";
import { deliverError, deliveryTexts } from "@kibo/sdk";
import { useEffect, useState } from "react";
import { client } from "../api";

export type DeliverChildrenState = { parent: { keyLabel: string; title: string }; items: DeliveryItem[] };

export type DeliverFlow = {
  busy: boolean;
  error: string | null;
  children: DeliverChildrenState | null;
  deliver(): Promise<void>;
  closeChildren(): void;
};

type Target = Pick<TicketView, "id" | "keyLabel" | "title">;

export function useDeliver(projectId: string, ticket: Target): DeliverFlow {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<DeliverChildrenState | null>(null);
  const deliver = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await client.rpc({ method: "deliver", projectId, ticketId: ticket.id });
      if (result.kind === "parent") setChildren({ parent: ticket, items: result.items });
    } catch (e) {
      setError(deliveryTexts.failed(ticket.keyLabel, deliverError(e)));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, children, deliver, closeChildren: () => setChildren(null) };
}

export const activeRunOf = (runs: readonly RunView[] | undefined, ticketId: string): RunView | null =>
  runs?.find((r) => r.ticketId === ticketId && !isTerminal(r.state)) ?? null;

export const hasChildren = (project: Pick<ProjectSnapshot, "tickets">, ticketId: string): boolean =>
  project.tickets.some((t) => t.parentId === ticketId);

export function childrenItems(
  project: Pick<ProjectSnapshot, "tickets" | "questions" | "links">,
  runs: readonly RunView[] | undefined,
  parentId: string,
): DeliveryItem[] {
  const busy = new Set<string>();
  for (const r of runs ?? []) if (r.ticketId !== null && !isTerminal(r.state)) busy.add(r.ticketId);
  return deliveryOrder({ tickets: deliveryTicketsOf(project), links: project.links, busy, parentId });
}

async function askDeliveryAgent(projectId: string): Promise<boolean> {
  try {
    const answer = DeliveryAgent.nullable().safeParse(
      await client.rpc({ method: "deliveryAgent", projectId }),
    );
    return answer.success && answer.data !== null;
  } catch (e) {
    console.warn(`[kibo] delivery agent of ${projectId} unknown`, e);
    return false;
  }
}

export function useDeliveryAgentKnown(projectId: string): boolean {
  const [known, setKnown] = useState(false);
  useEffect(() => {
    let alive = true;
    setKnown(false);
    void askDeliveryAgent(projectId).then((k) => alive && setKnown(k));
    return () => {
      alive = false;
    };
  }, [projectId]);
  return known;
}
