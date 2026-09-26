import type { StatusId } from "@kibo/schema";
import { blocksDag, compareKeys, sortTickets } from "./blocks-dag";

export { compareKeys };

export type GraphTicket = { id: string; key: string; statusId: StatusId };
export type GraphEdge = { from: string; to: string; type: "blocks" | "relates" };

type Chain = { length: number; next: string | undefined };

export function criticalPath(tickets: GraphTicket[], edges: GraphEdge[]): string[] {
  const open = sortTickets(tickets.filter((t) => t.statusId !== "done"));
  const keyOf = new Map(open.map((t) => [t.id, t.key]));
  const { order, succ } = blocksDag(open, edges);
  const chains = new Map<string, Chain>();
  const compareFrom = (a: string | undefined, b: string | undefined): number => {
    let x = a;
    let y = b;
    while (x !== undefined && y !== undefined) {
      const c = compareKeys(keyOf.get(x) ?? x, keyOf.get(y) ?? y);
      if (c !== 0) return c;
      x = chains.get(x)?.next;
      y = chains.get(y)?.next;
    }
    return 0;
  };
  const better = (a: string, b: string | undefined): boolean => {
    if (b === undefined) return true;
    const la = chains.get(a)?.length ?? 0;
    const lb = chains.get(b)?.length ?? 0;
    return la > lb || (la === lb && compareFrom(a, b) < 0);
  };
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    if (id === undefined) continue;
    let best: string | undefined;
    for (const s of succ.get(id) ?? []) if (better(s, best)) best = s;
    chains.set(id, { length: 1 + (best === undefined ? 0 : (chains.get(best)?.length ?? 0)), next: best });
  }
  let start: string | undefined;
  for (const id of order) if (better(id, start)) start = id;
  const path: string[] = [];
  for (let id = start; id !== undefined; id = chains.get(id)?.next) path.push(id);
  return path.length > 1 ? path : [];
}
