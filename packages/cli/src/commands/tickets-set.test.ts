import { describe, expect, test } from "bun:test";
import type { ExternalRef, StatusId, TicketView } from "@kibo/schema";
import { runTicketsCommand } from "./tickets";
import { type FakeDaemonOptions, fakeDaemon, fakeTicket, SILO_META } from "./tickets-test-kit";

const BRANCH: ExternalRef = { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: "dev" };
const PR_URL = "https://github.com/silo-labs/silo-location/pull/20";

const movedTo =
  (statusId: StatusId): FakeDaemonOptions["declared"] =>
  (_req, ticket) => ({ ticket: { ...ticket, statusId }, statusChanged: true });

async function set(
  args: string[],
  tickets: TicketView[] = [fakeTicket({ id: "a", key: "SILO-33" })],
  options: FakeDaemonOptions = {},
  ident = "SILO-33",
) {
  const d = fakeDaemon(tickets, undefined, options);
  const code = await runTicketsCommand(["set", ident, ...args], {}, d.io, d.connect, "/nowhere");
  return { ...d, code };
}

describe("kibo tickets set branch= and pr=", () => {
  test("declares the branch to the daemon, the project read from the key", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne"]);
    expect(d.code).toBe(0);
    expect(d.calls).toContainEqual(
      expect.objectContaining({ method: "declareTicketRef", projectId: "p-silo" }),
    );
    expect(d.declarations()).toEqual([
      {
        ticketKey: "SILO-33",
        ref: { kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null },
      },
    ]);
    expect(d.commands()).toEqual([]);
    expect(d.out).toEqual(["✓ SILO-33 : branche feat/envoi-hors-ligne"]);
  });

  test("tells the status the declaration moved the ticket to", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne", "base=dev"], undefined, {
      declared: movedTo("in_progress"),
    });
    expect(d.declarations()).toEqual([{ ticketKey: "SILO-33", ref: BRANCH }]);
    expect(d.out).toEqual(["✓ SILO-33 : branche feat/envoi-hors-ligne (base dev) · En cours"]);
  });

  test("declares an open PR, which sends the ticket to review", async () => {
    const d = await set([`pr=${PR_URL}`], undefined, { declared: movedTo("in_review") });
    expect(d.declarations()).toEqual([
      {
        ticketKey: "SILO-33",
        ref: {
          kind: "github_pr",
          url: PR_URL,
          number: 20,
          state: "open",
          base: null,
          head: null,
          review: "none",
          checks: null,
        },
      },
    ]);
    expect(d.out).toEqual(["✓ SILO-33 : PR #20 · En review"]);
  });

  test("writes the status before declaring the branch", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne", "status=wip"]);
    expect(d.calls.map((c) => c.method)).toEqual([
      "listProjects",
      "getProject",
      "command",
      "declareTicketRef",
    ]);
    expect(d.out).toEqual(["✓ SILO-33 : statut wip, branche feat/envoi-hors-ligne"]);
  });

  test("leaves a branch already declared as it is", async () => {
    const d = await set(
      ["branch=feat/envoi-hors-ligne", "base=dev"],
      [fakeTicket({ id: "a", key: "SILO-33", refs: [BRANCH] })],
    );
    expect(d.declarations()).toEqual([]);
    expect(d.out).toEqual(["✓ SILO-33 : déjà à jour"]);
  });

  test("refuses an invalid branch name before reaching the daemon", async () => {
    const d = await set(["branch=feat/x y"]);
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : invalid branch: feat/x y"]);
    expect(d.calls).toEqual([]);
    expect((await set(["branch=feat/x", "base=dev..main"])).code).toBe(1);
  });

  test("needs branch= to accept base=", async () => {
    const d = await set(["base=dev"]);
    expect(d.code).toBe(2);
    expect(d.calls).toEqual([]);
  });
});

describe("kibo tickets set finds the project", () => {
  test("from --project first", async () => {
    const d = fakeDaemon([fakeTicket({ id: "a", key: "SILO-33" })]);
    const flags = { project: "Silo" };
    expect(await runTicketsCommand(["set", "C1-2", "status=wip"], flags, d.io, d.connect)).toBe(1);
    expect(d.err).toEqual(["Ticket introuvable : C1-2"]);
  });

  test("from the folder holding the current directory when the key has no prefix", async () => {
    const projects = [{ ...SILO_META, folder: "/work/silo" }];
    const tickets = [fakeTicket({ id: "f", key: "SILO-30", shortKey: "F5" })];
    const d = fakeDaemon(tickets, undefined, { projects });
    const code = await runTicketsCommand(["set", "F5", "status=wip"], {}, d.io, d.connect, "/work/silo/app");
    expect(code).toBe(0);
    expect(d.commands()).toEqual([{ method: "setStatus", ticketId: "f", statusId: "in_progress" }]);
  });

  test("names the prefix of a key no project owns", async () => {
    const d = await set(["status=wip"], undefined, {}, "ABC-1");
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Projet introuvable : ABC"]);
  });

  test("asks for --project with a feature key outside any project folder", async () => {
    const d = await set(["status=wip"], undefined, {}, "F5");
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : clé de fonctionnalité : précise --project SILO"]);
  });

  test("lists the known keys when several projects could hold the step", async () => {
    const projects = [SILO_META, { ...SILO_META, id: "p-pfd", key: "PFD", name: "Pfd" }];
    const d = await set(["status=wip"], undefined, { projects }, "F5");
    expect(d.err).toEqual([
      "Erreur INVALID_INPUT : clé de fonctionnalité : précise --project parmi SILO, PFD",
    ]);
  });
});

describe("kibo tickets set on a step that was not startable", () => {
  const waiting = fakeTicket({
    id: "a",
    key: "SILO-33",
    startable: false,
    startReason: { kind: "dependency", keys: ["SILO-30"] },
  });
  const tickets = [{ ...waiting, waitingOn: ["SILO-30"] }];

  test("records the branch, git rules, and warns on stderr with the reason", async () => {
    const d = await set(["branch=feat/envoi-hors-ligne"], tickets);
    expect(d.code).toBe(0);
    expect(d.declarations()).toHaveLength(1);
    expect(d.out).toEqual(["✓ SILO-33 : branche feat/envoi-hors-ligne"]);
    expect(d.err).toEqual(["⚠ SILO-33 n'était pas démarrable : attend SILO-30"]);
  });

  test("warns when the step is put in progress, not for other changes", async () => {
    expect((await set(["status=wip"], tickets)).err).toEqual([
      "⚠ SILO-33 n'était pas démarrable : attend SILO-30",
    ]);
    expect((await set(["status=blocked"], tickets)).err).toEqual([]);
    expect((await set([`pr=${PR_URL}`], tickets)).err).toEqual([]);
  });

  test("says nothing for a startable step or a branch already declared", async () => {
    expect((await set(["branch=feat/envoi-hors-ligne"])).err).toEqual([]);
    const declared = [{ ...waiting, waitingOn: ["SILO-30"], externalRefs: [BRANCH] }];
    expect((await set(["branch=feat/envoi-hors-ligne", "base=dev"], declared)).err).toEqual([]);
  });
});

describe("kibo tickets set hold=", () => {
  const since = "2026-10-16";
  const held = fakeTicket({ id: "a", key: "SILO-33", hold: { reason: "Accès au serveur", since } });

  test("puts the step on hold without sending a day: the daemon stamps it", async () => {
    const d = await set(["hold=Accès au serveur"]);
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "setHold", ticketId: "a", reason: "Accès au serveur" }]);
    expect(d.out).toEqual(["✓ SILO-33 : en attente : Accès au serveur"]);
  });

  test("resumes with hold=off, and says so", async () => {
    const d = await set(["hold=off"], [held]);
    expect(d.commands()).toEqual([{ method: "setHold", ticketId: "a", reason: null }]);
    expect(d.out).toEqual(["✓ SILO-33 : reprise"]);
  });

  test("sends nothing when the hold is already as asked", async () => {
    const off = await set(["hold=off"]);
    expect(off.commands()).toEqual([]);
    expect(off.out).toEqual(["✓ SILO-33 : déjà à jour"]);
    expect((await set(["hold=Accès au serveur"], [held])).commands()).toEqual([]);
    expect((await set(["hold=Autre raison"], [held])).commands()).toEqual([
      { method: "setHold", ticketId: "a", reason: "Autre raison" },
    ]);
  });

  test("refuses an empty reason as a usage error", async () => {
    const d = await set(["hold="]);
    expect(d.code).toBe(2);
    expect(d.err[0]).toBe("Erreur INVALID_INPUT : hold= attend une raison ou off");
    expect(d.calls).toEqual([]);
  });

  test("sends the hold before the status and the branch", async () => {
    const d = await set(["status=wip", "branch=feat/x", "hold=Accès au serveur"]);
    expect(d.calls.map((c) => c.method)).toEqual([
      "listProjects",
      "getProject",
      "command",
      "command",
      "declareTicketRef",
    ]);
    expect(d.commands().map((c) => c.method)).toEqual(["setHold", "setStatus"]);
    expect(d.out).toEqual(["✓ SILO-33 : en attente : Accès au serveur, statut wip, branche feat/x"]);
  });

  test("warns that a held step was not startable when a branch starts it", async () => {
    const onHold = { source: "own" as const, key: "SILO-33", reason: "Accès au serveur", since };
    const blocked = {
      ...held,
      startable: false,
      startReason: { kind: "onHold" as const, hold: onHold },
      onHold,
    };
    const d = await set(["hold=Accès au serveur", "branch=feat/x"], [blocked]);
    expect(d.declarations()).toHaveLength(1);
    expect(d.err).toEqual(["⚠ SILO-33 n'était pas démarrable : en attente : Accès au serveur"]);
  });
});
