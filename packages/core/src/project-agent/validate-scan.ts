import type { ActionType, ProposeBatchInput, ProposedAction } from "@kibo/schema";
import { type BatchContext, ticketByKey } from "./expected";
import { isNewRef } from "./refs";

export type Edge = { from: string; to: string };
export type Scan = {
  ctx: BatchContext;
  declared: Map<string, number>;
  touched: Set<string>;
  blocks: Edge[];
  removed: Set<string>;
  parents: Map<string, string | null>;
  recipients: string[];
  reopened: Set<string>;
};

export function openScan(input: ProposeBatchInput, ctx: BatchContext): Scan {
  const declared = new Map<string, number>();
  input.actions.forEach((a, i) => {
    if (a.type === "createTicket" && !declared.has(a.ref)) declared.set(a.ref, i);
  });
  return {
    ctx,
    declared,
    touched: new Set(),
    blocks: ctx.project.links.filter((l) => l.type === "blocks").map((l) => ({ from: l.from, to: l.to })),
    removed: new Set(),
    parents: new Map(ctx.project.tickets.map((t) => [t.id, t.parentId])),
    recipients: [],
    reopened: new Set(),
  };
}

export const nodeOf = (scan: Scan, ref: string): string =>
  isNewRef(ref) ? ref : (ticketByKey(scan.ctx.project)(ref)?.id ?? ref);

export function touch(scan: Scan, target: string): string[] {
  if (scan.touched.has(target)) return [`deux actions sur ${target}`];
  scan.touched.add(target);
  return [];
}

export type Check<T extends ActionType> = (
  scan: Scan,
  action: Extract<ProposedAction, { type: T }>,
  index: number,
) => string[];
