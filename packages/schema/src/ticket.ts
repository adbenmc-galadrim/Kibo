import { z } from "zod";
import { ExternalRef } from "./external-ref";
import { NodeId, TicketKey } from "./ids";
import { StatusId } from "./status";

export const Assignee = z.object({ kind: z.enum(["human", "agent"]), ref: z.string().min(1) });
export type Assignee = z.infer<typeof Assignee>;

export const Ticket = z
  .object({
    id: NodeId,
    key: TicketKey.nullable(),
    pendingSeq: z.number().int().positive().nullable(),
    title: z.string().trim().min(1),
    description: z.string(),
    statusId: StatusId,
    blockedReason: z.string().nullable(),
    domainId: z.string().nullable(),
    assignee: Assignee.nullable(),
    parentId: NodeId.nullable(),
    externalRefs: z.array(ExternalRef),
  })
  .superRefine((t, ctx) => {
    const hasReason = t.blockedReason !== null && t.blockedReason.trim().length > 0;
    if (t.statusId === "blocked" && !hasReason) {
      ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "BLOCKED_REASON_REQUIRED" });
    }
    if (t.statusId !== "blocked" && t.blockedReason !== null) {
      ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "reason only allowed when blocked" });
    }
    if (t.key === null && t.pendingSeq === null) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "a ticket needs a key or a pending sequence" });
    }
  });
export type Ticket = z.infer<typeof Ticket>;

export function ticketKeyLabel(t: { key: string | null }, projectKey: string): string {
  return t.key ?? `${projectKey}-…`;
}
