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
