import type { ProjectCommand, Ticket } from "@kibo/schema";

export const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const mine = { kind: "human", ref: "adam" } as const;
  const a = run({ method: "createTicket", title: "Arbre des pages", assignee: mine }) as Ticket;
  const b = run({ method: "createTicket", title: "Sync", assignee: mine }) as Ticket;
  run({ method: "createTicket", title: "Hors filtre", assignee: { kind: "human", ref: "lea" } });
  run({ method: "addLink", from: a.id, to: b.id, type: "blocks" });
  const agent = (ref: string) => ({ kind: "agent", ref }) as const;
  run({ method: "createTicket", title: "Récepteur", statusId: "in_progress", assignee: agent("opus-dev") });
  run({ method: "createTicket", title: "Watcher", statusId: "backlog", assignee: agent("opus-dev") });
  run({ method: "createTicket", title: "Review", statusId: "in_review", assignee: agent("sonnet-review") });
};
