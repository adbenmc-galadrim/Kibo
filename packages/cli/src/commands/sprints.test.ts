import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { sprintsCommand } from "./sprints";
import { fakeDaemon } from "./tickets-test-kit";

async function sprints(positional: string[], flags: Record<string, string | true>) {
  const d = fakeDaemon();
  const code = await sprintsCommand(positional, flags, d.io, d.connect);
  return { ...d, code };
}

describe("kibo sprints list", () => {
  test("gives the sprints in order, with their features as keys, in JSON", async () => {
    const d = await sprints(["list"], { project: "silo", json: true });
    expect(d.code).toBe(0);
    expect(JSON.parse(d.out.join("\n"))).toEqual([
      {
        id: "s41",
        code: "S41",
        name: "Accès",
        start: "2026-09-28",
        end: "2026-10-09",
        state: "done",
        features: [],
      },
      {
        id: "s42",
        code: "S42",
        name: "Saisie hors ligne",
        start: "2026-10-12",
        end: "2026-10-23",
        state: "current",
        features: ["SILO-30"],
      },
      {
        id: "s43",
        code: "S43",
        name: "Import et contrats",
        start: "2026-10-26",
        end: "2026-11-06",
        state: "planned",
        features: [],
      },
    ]);
  });

  test("writes one line per sprint", async () => {
    const d = await sprints(["list"], { project: "SILO" });
    expect(d.out).toEqual([
      "S41\tAccès\t2026-09-28\t2026-10-09\tdone\t-",
      "S42\tSaisie hors ligne\t2026-10-12\t2026-10-23\tcurrent\tSILO-30",
      "S43\tImport et contrats\t2026-10-26\t2026-11-06\tplanned\t-",
    ]);
  });

  test("refuses an unknown project and prints its usage", async () => {
    const unknown = await sprints(["list"], { project: "NOPE" });
    expect(unknown.code).toBe(1);
    expect(unknown.err).toEqual(["Projet introuvable : NOPE"]);
    expect((await sprints([], { project: "SILO" })).code).toBe(2);
  });

  test("suggests the project key when --project is missing", async () => {
    const d = await sprints(["list"], {});
    expect(d.code).toBe(2);
    expect(d.err).toEqual(["précise --project SILO"]);
  });

  test("prints its usage when --project is missing and Kibo is not running", async () => {
    const d = fakeDaemon();
    const down = async () => {
      throw new KiboError("DAEMON_NOT_RUNNING", "no daemon.json");
    };
    expect(await sprintsCommand(["list"], {}, d.io, down)).toBe(2);
    expect(d.err.join("\n")).toContain("kibo sprints list --project");
  });
});

const DATES = { start: "2026-11-09", end: "2026-11-20" };

describe("kibo sprints create", () => {
  test("create sends createSprint with the code as default name", async () => {
    const d = await sprints(["create", "S44"], { project: "SILO", ...DATES });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "createSprint", code: "S44", name: "S44", ...DATES }]);
    expect(d.out).toEqual(["✓ Sprint S44 créé : S44 (2026-11-09 → 2026-11-20)"]);
  });

  test("--name names the sprint and --json prints it", async () => {
    const d = await sprints(["create", "S44"], { project: "SILO", name: "Rapports", json: true, ...DATES });
    expect(JSON.parse(d.out.join("\n"))).toEqual({ id: "s-1", code: "S44", name: "Rapports", ...DATES });
  });

  test("create validates the dates", async () => {
    const d = await sprints(["create", "S44"], { project: "SILO", start: "2027-3-1", end: "2027-03-12" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Date invalide : 2027-3-1 (AAAA-MM-JJ)"]);
    expect(d.calls).toEqual([]);
  });

  test("create refuses an end before the start", async () => {
    const d = await sprints(["create", "S44"], { project: "SILO", start: "2026-11-20", end: "2026-11-09" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["La fin du sprint précède son début."]);
    expect(d.commands()).toEqual([]);
  });

  test("create without both dates is a usage error", async () => {
    expect((await sprints(["create", "S44"], { project: "SILO", start: DATES.start })).code).toBe(2);
    expect((await sprints(["create"], { project: "SILO", ...DATES })).code).toBe(2);
    expect((await sprints(["create", "S44"], { project: "SILO", name: true, ...DATES })).code).toBe(2);
  });
});

describe("kibo sprints update", () => {
  test("update sends a patch with only the given fields", async () => {
    const d = await sprints(["update", "S43"], { project: "SILO", end: "2026-11-13" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "updateSprint", sprintId: "s43", patch: { end: "2026-11-13" } }]);
    expect(d.out).toEqual(["✓ Sprint S43 modifié : Import et contrats (2026-10-26 → 2026-11-13)"]);
  });

  test("--json prints the sprint as the daemon gives it back", async () => {
    const d = await sprints(["update", "S43"], { project: "SILO", end: "2026-11-13", json: true });
    expect(JSON.parse(d.out.join("\n"))).toEqual({
      id: "s43",
      code: "S43",
      name: "Import et contrats",
      start: "2026-10-26",
      end: "2026-11-06",
    });
  });

  test("update renames the code and the name", async () => {
    const d = await sprints(["update", "import et contrats"], {
      project: "SILO",
      code: "S43b",
      name: "Import",
    });
    expect(d.commands()).toEqual([
      { method: "updateSprint", sprintId: "s43", patch: { code: "S43b", name: "Import" } },
    ]);
  });

  test("update without a field is a usage error", async () => {
    const d = await sprints(["update", "S43"], { project: "SILO" });
    expect(d.code).toBe(2);
    expect(d.err.join("\n")).toContain("kibo sprints update");
    expect(d.calls).toEqual([]);
  });

  test("update refuses an end before the start of the sprint", async () => {
    const d = await sprints(["update", "S43"], { project: "SILO", end: "2026-10-01" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["La fin du sprint précède son début."]);
    expect(d.commands()).toEqual([]);
  });

  test("an unknown sprint lists nothing and exits 1", async () => {
    const d = await sprints(["update", "S99"], { project: "SILO", end: "2026-11-13" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Sprint introuvable : S99"]);
    expect(d.out).toEqual([]);
    expect(d.commands()).toEqual([]);
  });
});

describe("kibo sprints assign", () => {
  test("assign F5 S43 sends setTicketSprint", async () => {
    const d = await sprints(["assign", "F5", "S43"], { project: "SILO" });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "setTicketSprint", ticketId: "f5", sprintId: "s43" }]);
    expect(d.out).toEqual(["✓ F5 : sprint S43"]);
  });

  test("assign --none clears the sprint", async () => {
    const d = await sprints(["assign", "F5"], { project: "SILO", none: true });
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([{ method: "setTicketSprint", ticketId: "f5", sprintId: null }]);
    expect(d.out).toEqual(["✓ F5 : sans sprint"]);
  });

  test("--json prints the feature as tickets list does", async () => {
    const d = await sprints(["assign", "F5", "S43"], { project: "SILO", json: true });
    expect(JSON.parse(d.out.join("\n"))).toMatchObject({ id: "f5", key: "SILO-30" });
  });

  test("assign on a step is refused before any call", async () => {
    const d = await sprints(["assign", "SILO-33", "S43"], { project: "SILO" });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Le sprint d'une étape vient de sa fonctionnalité : posez S43 sur F5."]);
    expect(d.commands()).toEqual([]);
  });

  test("clearing the sprint of a step is refused too", async () => {
    const d = await sprints(["assign", "SILO-33"], { project: "SILO", none: true });
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Le sprint d'une étape vient de sa fonctionnalité : retirez-le de F5."]);
    expect(d.commands()).toEqual([]);
  });

  test("an unknown sprint or ticket exits 1 without writing", async () => {
    const sprint = await sprints(["assign", "F5", "S99"], { project: "SILO" });
    expect(sprint.code).toBe(1);
    expect(sprint.err).toEqual(["Sprint introuvable : S99"]);
    expect(sprint.commands()).toEqual([]);
    const ticket = await sprints(["assign", "F9", "S43"], { project: "SILO" });
    expect(ticket.code).toBe(1);
    expect(ticket.err).toEqual(["Ticket introuvable : F9"]);
  });

  test("assign needs a sprint or --none, not both", async () => {
    expect((await sprints(["assign", "F5"], { project: "SILO" })).code).toBe(2);
    expect((await sprints(["assign", "F5", "S43"], { project: "SILO", none: true })).code).toBe(2);
  });
});
