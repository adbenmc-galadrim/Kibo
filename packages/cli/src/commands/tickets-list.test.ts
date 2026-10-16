import { describe, expect, test } from "bun:test";
import { parseArgs } from "../args";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon } from "./tickets-test-kit";

async function list(...args: string[]) {
  const d = fakeDaemon();
  const { flags } = parseArgs(["--project", "EMIS", ...args]);
  const code = await runTicketsCommand(["list"], flags, d.io, d.connect);
  const keys = d.out.map((l) => l.split("\t")[0]);
  return { ...d, code, keys };
}

describe("kibo tickets list --sprint", () => {
  test("keeps the tickets of a sprint by id, code or name, case ignored, steps included", async () => {
    expect((await list("--sprint", "S42")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "s42")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "terrain HORS ligne")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "S41")).keys).toEqual([]);
  });

  test("current is the sprint the daemon marks current", async () => {
    expect((await list("--sprint", "current")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "current", "--ready")).keys).toEqual(["EMIS-33", "EMIS-34"]);
  });

  test("none keeps what no sprint holds", async () => {
    expect((await list("--sprint", "none")).keys).toEqual(["EMIS-40", "EMIS-41", "EMIS-50"]);
  });

  test("refuses an unknown sprint and a missing value", async () => {
    const unknown = await list("--sprint", "S99");
    expect(unknown.code).toBe(1);
    expect(unknown.err).toEqual(["Sprint introuvable : S99"]);
    expect((await list("--sprint")).code).toBe(2);
  });

  test("gives the sprint, the feature and the optional flag in JSON", async () => {
    const d = await list("--json");
    const byKey = new Map(
      (JSON.parse(d.out.join("\n")) as { key: string }[]).map((t) => [t.key, t] as const),
    );
    expect(byKey.get("EMIS-34")).toMatchObject({
      sprint: { id: "s42", code: "S42", name: "Terrain hors ligne" },
      feature: { key: "EMIS-30", shortKey: "F5", title: "Titre EMIS-30" },
      optional: true,
    });
    expect(byKey.get("EMIS-30")).toMatchObject({
      sprint: { id: "s42", code: "S42", name: "Terrain hors ligne" },
      feature: { key: "EMIS-30", shortKey: "F5" },
      optional: false,
    });
    expect(byKey.get("EMIS-41")).toMatchObject({ sprint: null, feature: { shortKey: "F7" } });
    expect(byKey.get("EMIS-50")).toMatchObject({ sprint: null, feature: null, optional: false });
  });
});
