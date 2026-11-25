import type { Instance, ProjectCommand, ProjectSnapshot, Sprint, Ticket } from "@kibo/schema";
import { type PhoneFixture, phoneFixture } from "./app-test-kit";
import { putBlob } from "./fake-server-api";
import { projectSnapshot, SILO_TODAY } from "./project-fixture";
import { sealJson } from "./test-kit";

type Run = (cmd: ProjectCommand) => unknown;
const adam = { kind: "human", ref: "adam" } as const;

function seedSilo(run: Run): void {
  const s42 = run({
    method: "createSprint",
    code: "S42",
    name: "Saisie hors ligne",
    start: "2026-10-12",
    end: "2026-10-16",
  }) as Sprint;
  const box = run({ method: "createTicket", title: "Réaffecter un box", statusId: "todo" }) as Ticket;
  run({ method: "setTicketSprint", ticketId: box.id, sprintId: s42.id });
  run({ method: "createTicket", title: "Écran de réaffectation", parentId: box.id, statusId: "done" });
  const photos = run({ method: "createTicket", title: "Envoyer les photos d'un constat" }) as Ticket;
  const upload = run({ method: "createTicket", title: "Reprise des envois", parentId: photos.id }) as Ticket;
  run({ method: "setHold", ticketId: upload.id, reason: "Attend le retour de Silo SA", since: SILO_TODAY });
  run({ method: "createTicket", title: "Conflits de saisie", statusId: "in_review", assignee: adam });
  run({ method: "createTicket", title: "Route d'envoi des photos", statusId: "in_review", assignee: adam });
  run({ method: "createTicket", title: "Passage à Expo SDK 54", statusId: "todo", assignee: adam });
  run({
    method: "createTicket",
    title: "Relance des impayés",
    statusId: "todo",
    assignee: { kind: "human", ref: "lea" },
  });
}

export const siloSnapshot = (instances: Instance[] = []): ProjectSnapshot =>
  projectSnapshot({ id: "silo", name: "Silo", key: "SILO", color: "#14B8A6", seed: seedSilo, instances });

export const kanbanInstance = (config: Record<string, unknown>): Instance => ({
  id: "i-kanban",
  pageId: "page-1",
  component: "kanban@1.0.0",
  layout: { x: 0, y: 0, w: 12, h: 9 },
  config,
  componentHash: null,
});

export async function siloFixture(
  snapshot: ProjectSnapshot = siloSnapshot(),
  options: Parameters<typeof phoneFixture>[0] = {},
): Promise<PhoneFixture> {
  const fixture = await phoneFixture(options);
  putBlob(fixture.api, await sealJson(fixture.keys, "silo", "project", snapshot, { seq: 2 }));
  return fixture;
}

export const relayedCommands = (requests: unknown[]): unknown[] =>
  requests.flatMap((r) =>
    typeof r === "object" && r !== null && "method" in r && r.method === "command" && "command" in r
      ? [r.command]
      : [],
  );
