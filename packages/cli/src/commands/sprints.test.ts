import { describe, expect, test } from "bun:test";
import { sprintsCommand } from "./sprints";
import { fakeDaemon } from "./tickets-test-kit";

async function sprints(positional: string[], flags: Record<string, string | true>) {
  const d = fakeDaemon();
  const code = await sprintsCommand(positional, flags, d.io, d.connect);
  return { ...d, code };
}

describe("kibo sprints list", () => {
  test("gives the sprints in order, with their features as keys, in JSON", async () => {
    const d = await sprints(["list"], { project: "emis", json: true });
    expect(d.code).toBe(0);
    expect(JSON.parse(d.out.join("\n"))).toEqual([
      { id: "s41", name: "S41", start: "2026-09-28", end: "2026-10-09", state: "done", features: [] },
      {
        id: "s42",
        name: "S42",
        start: "2026-10-12",
        end: "2026-10-23",
        state: "current",
        features: ["EMIS-30"],
      },
      { id: "s43", name: "S43", start: "2026-10-26", end: "2026-11-06", state: "planned", features: [] },
    ]);
  });

  test("writes one line per sprint", async () => {
    const d = await sprints(["list"], { project: "EMIS" });
    expect(d.out).toEqual([
      "S41\t2026-09-28\t2026-10-09\tdone\t-",
      "S42\t2026-10-12\t2026-10-23\tcurrent\tEMIS-30",
      "S43\t2026-10-26\t2026-11-06\tplanned\t-",
    ]);
  });

  test("refuses an unknown project and prints its usage", async () => {
    const unknown = await sprints(["list"], { project: "NOPE" });
    expect(unknown.code).toBe(1);
    expect(unknown.err).toEqual(["Projet introuvable : NOPE"]);
    const usage = await sprints(["list"], {});
    expect(usage.code).toBe(2);
    expect(usage.err.join("\n")).toContain("kibo sprints list --project");
    expect((await sprints([], { project: "EMIS" })).code).toBe(2);
  });
});
