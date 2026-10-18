import { describe, expect, test } from "bun:test";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon, fakeTicket, TICKETS } from "./tickets-test-kit";

const FEATURE = fakeTicket({ id: "f6", key: "F6", shortKey: "F6" });
const MINE = {
  ...fakeTicket({
    id: "mine",
    key: "EMIS-60",
    refs: [{ kind: "git_branch", branch: "feat/x", base: "dev" }],
  }),
  assignee: { kind: "human" as const, ref: "u-me" },
};

async function get(ident: string, flags: Record<string, string> = {}) {
  const d = fakeDaemon([...TICKETS, FEATURE, MINE]);
  const code = await runTicketsCommand(["get", ident], flags, d.io, d.connect, "/nowhere");
  return { ...d, code };
}

describe("kibo tickets get", () => {
  test("says there is no dependency", async () => {
    const d = await get("EMIS-50");
    expect(d.code).toBe(0);
    expect(d.out).toContain("Dépendances : aucune");
  });

  test("shows the declared branch and names the viewer as assignee", async () => {
    const d = await get("EMIS-60");
    expect(d.out).toContain("Branche : feat/x (base dev)");
    expect(d.out).toContain("Assigné : moi");
  });

  test("finds a feature by its F key once the project is given", async () => {
    const created = await get("F6", { project: "EMIS" });
    expect(created.code).toBe(0);
    expect(created.out[0]).toBe("F6 · Titre F6");
    const legacy = await get("F5", { project: "EMIS" });
    expect(legacy.out[0]).toBe("EMIS-30 · Titre EMIS-30");
  });

  test("asks for --project with a feature key and no project folder", async () => {
    const d = await get("F6");
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Erreur INVALID_INPUT : clé de fonctionnalité : préciser --project"]);
    expect(d.calls).toEqual([{ method: "listProjects" }]);
  });

  test("keeps asking for --project with a plan id and no project folder", async () => {
    const d = await get("C1-2");
    expect(d.code).toBe(2);
    expect(d.err.at(-1)).toContain("kibo tickets get <clé|id du plan>");
  });
});
