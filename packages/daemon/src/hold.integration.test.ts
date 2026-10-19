import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import type { DeclareTicketRefResult, ProjectEventPage } from "@kibo/schema";
import { z } from "zod";
import { type Client, cleanSuivi, createSuivi, projectOf, until } from "./suivi.test-helper";

afterEach(cleanSuivi);

const BRANCH = "feat/silo-2-envoi";
const REASON = "Serveur MinIO de recette indisponible";
const DAY = "2026-10-16";
const Created = z.object({ id: z.string() });

async function createSilo(client: Client, folder: string): Promise<string> {
  const created = await client.rpc({
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder,
    color: "#F97316",
  });
  return Created.parse(created).id;
}

test("a hold is dated by the daemon, journaled, kept by a branch and dropped by a merge", async () => {
  const suivi = createSuivi();
  const client = await suivi.start(50);
  const projectId = await createSilo(client, suivi.repo.repo);
  const silo = projectOf(client, projectId);
  const feature = await silo.create({ method: "createTicket", title: "Saisie hors ligne" });
  const step = (title: string) =>
    silo.create({ method: "createTicket", title, parentId: feature, statusId: "todo" });
  const send = await step("Écran d'envoi hors ligne");
  const sync = await step("Synchronisation");
  const report = await step("Rapport d'envoi");
  await silo.command({ method: "addLink", from: send, to: sync, type: "blocks" });
  const hold = (ticketId: string, reason: string | null) =>
    silo.command({ method: "setHold", ticketId, reason });
  const eventsOf = (ticketId: string) =>
    client.rpc<ProjectEventPage>({ method: "listProjectEvents", projectId, ticketId, limit: 50 });

  await hold(send, REASON);
  const held = await silo.ticket("SILO-2");
  expect(held.hold).toEqual({ reason: REASON, since: DAY });
  expect(held.onHold).toEqual({ source: "own", key: "SILO-2", reason: REASON, since: DAY });
  expect(held.startReason?.kind).toBe("onHold");
  expect(held.statusId).toBe("todo");
  expect((await silo.ticket("SILO-3")).onHold).toMatchObject({ source: "dependency", key: "SILO-2" });
  expect((await eventsOf(send)).items).toMatchObject([
    { kind: "held", source: "user", data: { reason: REASON } },
  ]);

  await hold(send, null);
  expect((await silo.ticket("SILO-2")).onHold).toBeNull();
  expect((await silo.ticket("SILO-3")).onHold).toBeNull();
  expect((await eventsOf(send)).items[0]).toMatchObject({ kind: "resumed", data: { reason: REASON } });

  await hold(send, REASON);
  await hold(report, REASON);
  const declared = await client.rpc<DeclareTicketRefResult>({
    method: "declareTicketRef",
    projectId,
    ticketKey: "SILO-2",
    ref: { kind: "git_branch", branch: BRANCH, base: "main" },
  });
  expect(declared.statusChanged).toBe(true);
  const started = await silo.ticket("SILO-2");
  expect(started.statusId).toBe("in_progress");
  expect(started.hold).toEqual({ reason: REASON, since: DAY });
  expect((await silo.ticket("SILO-1")).feature?.held).toBe(3);

  suivi.repo.git("worktree", "add", "-q", "-b", BRANCH, join(suivi.repo.dir, "silo-2"));
  suivi.prs([
    {
      number: 20,
      url: "https://github.com/silo-labs/silo-location/pull/20",
      state: "MERGED",
      isDraft: false,
      head: BRANCH,
      base: "main",
      reviewDecision: "APPROVED",
      statusCheckRollup: [],
    },
  ]);
  const merged = await until(async () => {
    const ticket = await silo.ticket("SILO-2");
    return ticket.statusId === "done" ? ticket : undefined;
  }, "SILO-2 done");
  expect(merged.onHold).toBeNull();
  expect((await silo.ticket("SILO-3")).onHold).toBeNull();
  expect((await silo.ticket("SILO-1")).feature?.held).toBe(1);
}, 90_000);
