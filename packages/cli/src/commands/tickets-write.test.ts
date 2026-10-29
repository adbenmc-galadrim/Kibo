import { describe, expect, test } from "bun:test";
import { KiboError, type TicketView } from "@kibo/schema";
import type { Parsed } from "../args";
import { explainError } from "../error-text";
import { runTicketsCommand } from "./tickets";
import { type FakeDaemonOptions, fakeDaemon, fakeTicket, TICKETS } from "./tickets-test-kit";

async function tickets(
  positional: string[],
  flags: Parsed["flags"] = {},
  options: FakeDaemonOptions = {},
  list: TicketView[] = TICKETS,
) {
  const d = fakeDaemon(list, undefined, options);
  const code = await runTicketsCommand(positional, flags, d.io, d.connect, "/nowhere");
  return { ...d, code };
}

async function rejection(run: Promise<unknown>): Promise<KiboError> {
  const e = await run.then(
    () => null,
    (error: unknown) => error,
  );
  if (!(e instanceof KiboError)) throw new Error("expected a KiboError");
  return e;
}

const failing = (detail: string): FakeDaemonOptions => ({
  onCommand: () => {
    throw new KiboError("INVALID_INPUT", detail);
  },
});

describe("kibo tickets create", () => {
  test("create needs --feature", async () => {
    const d = await tickets(["create", "Relevé"], { project: "SILO" });
    expect(d.code).toBe(2);
    expect(d.calls).toEqual([]);
  });

  test("creates a step under F5", async () => {
    const d = await tickets(["create", "Relevé des compteurs"], { project: "SILO", feature: "F5" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      {
        method: "createTicket",
        title: "Relevé des compteurs",
        parentId: "f5",
        description: undefined,
        labels: undefined,
      },
    ]);
    expect(d.out).toEqual(["✓ SILO-101 créée : Relevé des compteurs (F5)"]);
  });

  test("--feature accepts the key of the root ticket, not a step", async () => {
    const byKey = await tickets(["create", "R"], { project: "SILO", feature: "SILO-40" });
    expect(byKey.commands()).toEqual([expect.objectContaining({ parentId: "f7" })]);
    const step = await rejection(tickets(["create", "R"], { project: "SILO", feature: "SILO-33" }));
    expect(explainError(step)).toBe("SILO-33 est une étape de F5 : donnez la fonctionnalité.");
  });

  test("an unknown feature writes nothing", async () => {
    const d = await tickets(["create", "R"], { project: "SILO", feature: "F9" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Ticket introuvable : F9"]);
    expect(d.commands()).toEqual([]);
  });

  test("--optional chains setTicketOptional", async () => {
    const d = await tickets(["create", "R"], { project: "SILO", feature: "F5", optional: true });
    expect(d.commands()).toEqual([
      expect.objectContaining({ method: "createTicket", parentId: "f5" }),
      { method: "setTicketOptional", ticketId: "t-1", optional: true },
    ]);
    expect(d.out).toEqual(["✓ SILO-101 créée : R (F5) · facultative"]);
  });

  test("--description and --labels are sent, --json prints the step in list form", async () => {
    const d = await tickets(["create", "R"], {
      project: "SILO",
      feature: "F5",
      description: "Texte",
      labels: "terrain",
      json: true,
    });
    expect(d.commands()).toEqual([expect.objectContaining({ description: "Texte", labels: ["terrain"] })]);
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "t-1", key: "SILO-101" });
  });

  test("--append on create is a usage error", async () => {
    const d = await tickets(["create", "R"], { project: "SILO", feature: "F5", append: "B" });
    expect(d.code).toBe(2);
    expect(d.commands()).toEqual([]);
  });
});

describe("kibo tickets update", () => {
  test("update --title and --labels send one updateTicket", async () => {
    const d = await tickets(["update", "SILO-33"], { title: "Nouveau titre", labels: "a, b" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      { method: "updateTicket", ticketId: "a", title: "Nouveau titre", labels: ["a", "b"] },
    ]);
    expect(d.out).toEqual(["✓ SILO-33 : titre, étiquettes"]);
  });

  test('--labels "" clears the labels', async () => {
    const d = await tickets(["update", "SILO-33"], { labels: "" });
    expect(d.commands()).toEqual([{ method: "updateTicket", ticketId: "a", labels: [] }]);
  });

  test("--append reads the current description then rewrites it", async () => {
    const list = [fakeTicket({ id: "a", key: "SILO-33", description: "Avant" })];
    const d = await tickets(["update", "SILO-33"], { append: "Suite" }, {}, list);
    expect(d.commands()).toEqual([{ method: "updateTicket", ticketId: "a", description: "Avant\n\nSuite" }]);
    expect(d.out).toEqual(["✓ SILO-33 : description"]);
  });

  test("--prepend and --description", async () => {
    const list = [fakeTicket({ id: "a", key: "SILO-33", description: "Avant" })];
    const pre = await tickets(["update", "SILO-33"], { prepend: "Tête" }, {}, list);
    expect(pre.commands()).toEqual([{ method: "updateTicket", ticketId: "a", description: "Tête\n\nAvant" }]);
    const rep = await tickets(["update", "SILO-33"], { description: "Neuve" }, {}, list);
    expect(rep.commands()).toEqual([{ method: "updateTicket", ticketId: "a", description: "Neuve" }]);
  });

  test("--description and --append together is a usage error", async () => {
    const d = await tickets(["update", "SILO-33"], { description: "A", append: "B" });
    expect(d.code).toBe(2);
    expect(d.err[0]).toBe("--description, --append et --prepend s'excluent.");
    expect(d.commands()).toEqual([]);
  });

  test("update without any change is a usage error", async () => {
    const d = await tickets(["update", "SILO-33"]);
    expect(d.code).toBe(2);
    expect(d.err[0]).toBe(
      "Rien à modifier : donnez --title, --description, --append, --prepend ou --labels.",
    );
    expect(d.commands()).toEqual([]);
  });

  test("an unknown ticket is not found", async () => {
    const d = await tickets(["update", "SILO-99"], { title: "T" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Ticket introuvable : SILO-99"]);
  });

  test("--json prints the ticket read again", async () => {
    const d = await tickets(["update", "SILO-33"], { title: "T", json: true });
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "a", key: "SILO-33" });
  });
});

describe("kibo tickets move", () => {
  test("move sends moveTicket to the feature id", async () => {
    const d = await tickets(["move", "SILO-41"], { feature: "F5" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "moveTicket", ticketId: "c", parentId: "f5" }]);
    expect(d.out).toEqual(["✓ SILO-41 déplacée sous F5"]);
  });

  test("--json prints the moved ticket", async () => {
    const d = await tickets(["move", "SILO-41"], { feature: "F5", json: true });
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "c", key: "SILO-41" });
  });

  test("an unknown ticket or feature writes nothing", async () => {
    const ticket = await tickets(["move", "SILO-99"], { feature: "F5" });
    expect(ticket.err).toEqual(["Ticket introuvable : SILO-99"]);
    const feature = await tickets(["move", "SILO-41"], { feature: "F9" });
    expect(feature.err).toEqual(["Ticket introuvable : F9"]);
    expect([...ticket.commands(), ...feature.commands()]).toEqual([]);
  });

  test("moving a feature is refused by the daemon and translated", async () => {
    const e = await rejection(
      tickets(["move", "F7"], { feature: "F5", project: "SILO" }, failing("a feature is a root ticket")),
    );
    expect(explainError(e)).toBe(
      "Une fonctionnalité est un ticket racine : elle ne se déplace pas sous un autre ticket.",
    );
  });
});
