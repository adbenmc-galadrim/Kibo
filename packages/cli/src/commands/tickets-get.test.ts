import { describe, expect, test } from "bun:test";
import type { Parsed } from "../args";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon, fakeTicket, TICKETS } from "./tickets-test-kit";

type Flags = Parsed["flags"];

const HELD = fakeTicket({
  id: "held",
  key: "SILO-70",
  onHold: { source: "own", key: "SILO-70", reason: "Serveur de recette indisponible", since: "2026-10-16" },
});
const WAITING = fakeTicket({
  id: "waiting",
  key: "SILO-71",
  onHold: {
    source: "dependency",
    key: "SILO-70",
    reason: "Serveur de recette indisponible",
    since: "2026-10-16",
  },
});
const FEATURE = fakeTicket({ id: "f6", key: "F6", shortKey: "F6" });
const MINE = {
  ...fakeTicket({
    id: "mine",
    key: "SILO-60",
    refs: [{ kind: "git_branch", branch: "feat/x", base: "dev" }],
  }),
  assignee: { kind: "human" as const, ref: "u-me" },
};

async function get(ident: string, flags: Flags = {}) {
  const d = fakeDaemon([...TICKETS, FEATURE, MINE, HELD, WAITING]);
  const code = await runTicketsCommand(["get", ident], flags, d.io, d.connect, "/nowhere");
  return { ...d, code };
}

describe("kibo tickets get", () => {
  test("the CLI prints Étape", async () => {
    const stepped = {
      ...fakeTicket({ id: "stepped", key: "SILO-72" }),
      delivery: { step: 9, note: "", at: 1, runId: null, kind: "delivery" as const },
    };
    const d = fakeDaemon([...TICKETS, stepped]);
    await runTicketsCommand(["get", "SILO-72"], {}, d.io, d.connect, "/nowhere");
    expect(d.out).toContain("Étape 9/12 · Review");
  });

  test("says there is no dependency", async () => {
    const d = await get("SILO-50");
    expect(d.code).toBe(0);
    expect(d.out).toContain("Dépendances : aucune");
  });

  test("shows the declared branch and names the viewer as assignee", async () => {
    const d = await get("SILO-60");
    expect(d.out).toContain("Branche : feat/x (base dev)");
    expect(d.out).toContain("Assigné : moi");
  });

  test("finds a feature by its F key once the project is given", async () => {
    const created = await get("F6", { project: "SILO" });
    expect(created.code).toBe(0);
    expect(created.out[0]).toBe("F6 · Titre F6");
    const legacy = await get("F5", { project: "SILO" });
    expect(legacy.out[0]).toBe("SILO-30 · Titre SILO-30");
  });

  test("asks for --project with a feature key and no project folder", async () => {
    const d = await get("F6");
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : clé de fonctionnalité : précise --project SILO"]);
    expect(d.calls).toEqual([{ method: "listProjects" }]);
  });

  test("keeps asking for --project with a plan id and no project folder", async () => {
    const d = await get("C1-2");
    expect(d.code).toBe(2);
    expect(d.err).toEqual(["précise --project SILO"]);
  });

  test("shows the hold right after the status, and nothing without one", async () => {
    const held = await get("SILO-70");
    const status = held.out.findIndex((l) => l.startsWith("Statut"));
    expect(held.out[status + 1]).toBe("En attente : Serveur de recette indisponible · depuis le 16 oct.");
    expect((await get("SILO-71")).out).toContain("En attente de SILO-70");
    expect((await get("SILO-50")).out.some((l) => l.startsWith("En attente"))).toBe(false);
  });

  test("gives the hold as it is in JSON", async () => {
    const d = await get("SILO-70", { json: true });
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ onHold: HELD.onHold });
    const free = await get("SILO-50", { json: true });
    expect(JSON.parse(free.out.join("\n"))).toMatchObject({ onHold: null });
  });
});
