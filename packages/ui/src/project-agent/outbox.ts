import type { RunLogEntry } from "@kibo/schema";
import type { ConversationItem } from "./conversation";

export type OutboxState = "sending" | "failed";
export type OutboxItem = { id: string; text: string; at: number; state: OutboxState };

export function mergeOutbox(
  items: readonly ConversationItem[],
  outbox: readonly OutboxItem[],
): ConversationItem[] {
  return [
    ...items,
    ...outbox.map(
      (o): ConversationItem => ({ kind: "user", id: o.id, at: o.at, text: o.text, pending: o.state }),
    ),
  ];
}

export function settleOutbox(outbox: readonly OutboxItem[], log: readonly RunLogEntry[]): OutboxItem[] {
  const unclaimed = log.filter((entry) => entry.event.type === "answered");
  return outbox.filter((item) => {
    if (item.state === "failed") return true;
    const k = unclaimed.findIndex(
      (entry) => entry.event.type === "answered" && entry.event.text === item.text && entry.at >= item.at,
    );
    if (k < 0) return true;
    unclaimed.splice(k, 1);
    return false;
  });
}
