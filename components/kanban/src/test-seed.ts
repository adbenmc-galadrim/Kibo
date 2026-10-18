import type { ProjectCommand, Sprint, Ticket } from "@kibo/schema";

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

type Run = (cmd: ProjectCommand) => unknown;

const pr = (number: number, review: "none" | "changes_requested", checks: "ok" | "error" | "running") => ({
  kind: "github_pr" as const,
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state: "open" as const,
  base: "main",
  head: `feat/${number}`,
  review,
  checks,
});

const step = (run: Run, parentId: string, title: string, statusId: "todo" | "in_review" = "todo") =>
  run({ method: "createTicket", title, parentId, statusId }) as Ticket;

export const trackingSeed = (run: Run) => {
  const s42 = run({
    method: "createSprint",
    code: "S42",
    name: "S42",
    start: "2026-10-12",
    end: "2026-10-16",
  }) as Sprint;
  const s43 = run({
    method: "createSprint",
    code: "S43",
    name: "S43",
    start: "2026-10-19",
    end: "2026-10-23",
  }) as Sprint;
  const f1 = run({ method: "createTicket", title: "Saisie terrain" }) as Ticket;
  const conflicts = step(run, f1.id, "Conflits de saisie", "in_review");
  const photos = step(run, f1.id, "Route d'envoi des photos", "in_review");
  const excel = step(run, f1.id, "Lecture du fichier Excel");
  const demo = step(run, f1.id, "Démo client");
  const f2 = run({ method: "createTicket", title: "Import" }) as Ticket;
  const importScreen = step(run, f2.id, "Écran d'import");
  step(run, f2.id, "Démo client");
  const expo = run({
    method: "createTicket",
    title: "Passage à Expo SDK 54",
    statusId: "in_review",
  }) as Ticket;
  run({ method: "createTicket", title: "Hors filtre", assignee: { kind: "human", ref: "lea" } });
  run({ method: "setTicketSprint", ticketId: f1.id, sprintId: s42.id });
  run({ method: "setTicketSprint", ticketId: f2.id, sprintId: s43.id });
  run({ method: "upsertExternalRef", ticketId: conflicts.id, ref: pr(20, "changes_requested", "error") });
  run({ method: "upsertExternalRef", ticketId: photos.id, ref: pr(22, "none", "ok") });
  run({ method: "upsertExternalRef", ticketId: expo.id, ref: pr(23, "none", "running") });
  run({ method: "setTicketOptional", ticketId: demo.id, optional: true });
  run({
    method: "upsertExternalRef",
    ticketId: importScreen.id,
    ref: { kind: "git_branch", branch: "feat/emis-import", base: null },
  });
  run({
    method: "createQuestion",
    ticketId: excel.id,
    title: "Quel format pour l'import Excel ?",
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
    importRef: { kind: "import_ref", source: "plan", id: "Q14" },
  });
};
