import { describe, expect, test } from "bun:test";
import { parseArgs } from "../args";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon, fakeTicket, SPRINTS } from "./tickets-test-kit";

async function listIn(d: ReturnType<typeof fakeDaemon>, args: string[]) {
  const { flags } = parseArgs(["--project", "EMIS", ...args]);
  const code = await runTicketsCommand(["list"], flags, d.io, d.connect);
  const keys = d.out.map((l) => l.split("\t")[0]);
  return { ...d, code, keys };
}

const list = (...args: string[]) => listIn(fakeDaemon(), args);

describe("kibo tickets list --sprint", () => {
  test("keeps the tickets of a sprint by id, code or name, case ignored, steps included", async () => {
    expect((await list("--sprint", "S42")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "s42")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "terrain HORS ligne")).keys).toEqual(["EMIS-30", "EMIS-33", "EMIS-34"]);
    expect((await list("--sprint", "S41")).keys).toEqual([]);
  });

  test("an id wins over a code, a code over a name", async () => {
    const [base] = SPRINTS;
    if (base === undefined) throw new Error("no sprint in the kit");
    const sprints = [
      { ...base, id: "alpha", code: "BETA", name: "Gamma" },
      { ...base, id: "s2", code: "ALPHA", name: "Beta" },
      { ...base, id: "s3", code: "Z1", name: "alpha" },
    ];
    const tickets = sprints.map((s, i) => fakeTicket({ id: `t${i}`, key: `EMIS-${i + 1}`, sprintId: s.id }));
    const pick = async (wanted: string) =>
      (await listIn(fakeDaemon(tickets, sprints), ["--sprint", wanted])).keys;
    expect(await pick("alpha")).toEqual(["EMIS-1"]);
    expect(await pick("beta")).toEqual(["EMIS-1"]);
    expect(await pick("Gamma")).toEqual(["EMIS-1"]);
    expect(await pick("s2")).toEqual(["EMIS-2"]);
    expect(await pick("z1")).toEqual(["EMIS-3"]);
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
