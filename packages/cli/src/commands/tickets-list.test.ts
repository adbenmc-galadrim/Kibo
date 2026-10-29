import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { parseArgs } from "../args";
import { runTicketsCommand } from "./tickets";
import { fakeDaemon, fakeTicket, SILO_META, SPRINTS, TICKETS } from "./tickets-test-kit";

async function listIn(d: ReturnType<typeof fakeDaemon>, args: string[]) {
  const { flags } = parseArgs(["--project", "SILO", ...args]);
  const code = await runTicketsCommand(["list"], flags, d.io, d.connect);
  const rows = d.out[0]?.startsWith("Clé") ? d.out.slice(1) : [];
  const keys = rows.map((l) => l.split(/\s+/)[0]);
  return { ...d, code, keys };
}

const list = (...args: string[]) => listIn(fakeDaemon(), args);

describe("kibo tickets list --sprint", () => {
  test("keeps the tickets of a sprint by id, code or name, case ignored, steps included", async () => {
    expect((await list("--sprint", "S42")).keys).toEqual(["SILO-30", "SILO-33", "SILO-34"]);
    expect((await list("--sprint", "s42")).keys).toEqual(["SILO-30", "SILO-33", "SILO-34"]);
    expect((await list("--sprint", "saisie HORS ligne")).keys).toEqual(["SILO-30", "SILO-33", "SILO-34"]);
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
    const tickets = sprints.map((s, i) => fakeTicket({ id: `t${i}`, key: `SILO-${i + 1}`, sprintId: s.id }));
    const pick = async (wanted: string) =>
      (await listIn(fakeDaemon(tickets, sprints), ["--sprint", wanted])).keys;
    expect(await pick("alpha")).toEqual(["SILO-1"]);
    expect(await pick("beta")).toEqual(["SILO-1"]);
    expect(await pick("Gamma")).toEqual(["SILO-1"]);
    expect(await pick("s2")).toEqual(["SILO-2"]);
    expect(await pick("z1")).toEqual(["SILO-3"]);
  });

  test("current is the sprint the daemon marks current", async () => {
    expect((await list("--sprint", "current")).keys).toEqual(["SILO-30", "SILO-33", "SILO-34"]);
    expect((await list("--sprint", "current", "--ready")).keys).toEqual(["SILO-33", "SILO-34"]);
  });

  test("none keeps what no sprint holds", async () => {
    expect((await list("--sprint", "none")).keys).toEqual(["SILO-40", "SILO-41", "SILO-50"]);
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
    expect(byKey.get("SILO-34")).toMatchObject({
      sprint: { id: "s42", code: "S42", name: "Saisie hors ligne" },
      feature: { key: "SILO-30", shortKey: "F5", title: "Titre SILO-30" },
      optional: true,
    });
    expect(byKey.get("SILO-30")).toMatchObject({
      sprint: { id: "s42", code: "S42", name: "Saisie hors ligne" },
      feature: { key: "SILO-30", shortKey: "F5" },
      optional: false,
    });
    expect(byKey.get("SILO-41")).toMatchObject({ sprint: null, feature: { shortKey: "F7" } });
    expect(byKey.get("SILO-50")).toMatchObject({ sprint: null, feature: null, optional: false });
  });
});

describe("kibo tickets list, as text", () => {
  test("puts headers and the feature column", async () => {
    const d = await list();
    expect(d.out[0]?.split(/\s+/)).toEqual(["Clé", "F", "Statut", "Titre"]);
    expect(
      d.out
        .find((l) => l.startsWith("SILO-33"))
        ?.split(/\s+/)
        .slice(0, 2),
    ).toEqual(["SILO-33", "F5"]);
    expect(
      d.out
        .find((l) => l.startsWith("SILO-50"))
        ?.split(/\s+/)
        .slice(0, 2),
    ).toEqual(["SILO-50", "-"]);
  });

  test("says when nothing matches, naming the filters", async () => {
    const d = await list("--sprint", "S41", "--ready");
    expect(d.code).toBe(0);
    expect(d.out).toEqual(["Aucun ticket pour ces filtres : --ready --sprint S41"]);
    const empty = await listIn(fakeDaemon([]), []);
    expect(empty.out).toEqual(["Aucun ticket dans ce projet."]);
    const json = await list("--sprint", "S41", "--json");
    expect(json.out).toEqual(["[]"]);
  });
});

describe("kibo tickets list --ready", () => {
  test("keeps what the daemon says is startable, whatever the local status", async () => {
    const waiting = { kind: "sprint" as const, code: "S43" };
    const tickets = [
      fakeTicket({ id: "a", key: "SILO-1" }),
      fakeTicket({ id: "b", key: "SILO-2", startable: false, startReason: waiting }),
      fakeTicket({ id: "c", key: "SILO-3", statusId: "backlog" }),
    ];
    expect((await listIn(fakeDaemon(tickets), ["--ready"])).keys).toEqual(["SILO-1", "SILO-3"]);
    const json = await listIn(fakeDaemon(tickets), ["--json"]);
    expect(JSON.parse(json.out.join("\n"))).toMatchObject([
      { key: "SILO-1", startable: true, startReason: null },
      { key: "SILO-2", startable: false, startReason: waiting },
      { key: "SILO-3", startable: true },
    ]);
  });
});

describe("kibo tickets list, held steps", () => {
  const onHold = { source: "own" as const, key: "SILO-2", reason: "Accès", since: "2026-10-16" };
  const tickets = [
    fakeTicket({ id: "a", key: "SILO-1" }),
    fakeTicket({
      id: "b",
      key: "SILO-2",
      startable: false,
      startReason: { kind: "onHold", hold: onHold },
      onHold,
    }),
  ];

  test("marks the status of a held step with ⏸, headers unchanged", async () => {
    const d = await listIn(fakeDaemon(tickets), []);
    expect(d.out[0]?.split(/\s+/)).toEqual(["Clé", "F", "Statut", "Titre"]);
    expect(d.out.find((l) => l.startsWith("SILO-2"))).toContain("⏸ todo");
    expect(d.out.find((l) => l.startsWith("SILO-1"))).not.toContain("⏸");
  });

  test("gives the hold in JSON and leaves it out of --ready", async () => {
    const json = await listIn(fakeDaemon(tickets), ["--json"]);
    expect(JSON.parse(json.out.join("\n"))).toMatchObject([
      { key: "SILO-1", onHold: null },
      { key: "SILO-2", onHold },
    ]);
    expect((await listIn(fakeDaemon(tickets), ["--ready"])).keys).toEqual(["SILO-1"]);
  });
});

describe("kibo tickets list without --project", () => {
  test("suggests the only project key, or lists the known ones", async () => {
    const one = fakeDaemon();
    expect(await runTicketsCommand(["list"], {}, one.io, one.connect)).toBe(2);
    expect(one.err).toEqual(["précise --project SILO"]);
    const projects = [SILO_META, { ...SILO_META, id: "p-pfd", key: "PFD", name: "Pfd" }];
    const two = fakeDaemon(undefined, undefined, { projects });
    expect(await runTicketsCommand(["list"], {}, two.io, two.connect)).toBe(2);
    expect(two.err).toEqual(["précise --project parmi SILO, PFD"]);
  });

  test("prints its usage when Kibo knows no project", async () => {
    const none = fakeDaemon(undefined, undefined, { projects: [] });
    expect(await runTicketsCommand(["list"], {}, none.io, none.connect)).toBe(2);
    expect(none.err.join("\n")).toContain("kibo tickets list --project");
  });
});

describe("kibo tickets list --feature, --label", () => {
  const labelled = TICKETS.map((t) =>
    t.key === "SILO-33"
      ? { ...t, labels: ["area:web"] }
      : t.key === "SILO-50"
        ? { ...t, labels: ["area:api", "x"] }
        : t,
  );

  test("--feature F5 keeps the feature and its steps", async () => {
    expect((await list("--feature", "F5")).keys).toEqual(["SILO-30", "SILO-33", "SILO-34"]);
    expect((await list("--feature", "silo-40")).keys).toEqual(["SILO-40", "SILO-41"]);
  });

  test("--feature with a step key is refused", async () => {
    await expect(list("--feature", "SILO-33")).rejects.toThrow(
      new KiboError("INVALID_INPUT", "SILO-33 is a step of F5: give the feature"),
    );
    const unknown = await list("--feature", "F99");
    expect(unknown.code).toBe(1);
    expect(unknown.err).toEqual(["Ticket introuvable : F99"]);
  });

  test("--label area:web keeps tickets having one of the labels", async () => {
    const pick = async (...args: string[]) => (await listIn(fakeDaemon(labelled), args)).keys;
    expect(await pick("--label", "area:web")).toEqual(["SILO-33"]);
    expect(await pick("--label", "area:web,area:api")).toEqual(["SILO-33", "SILO-50"]);
    expect(await pick("--label", "area:web", "--feature", "F7")).toEqual([]);
  });

  test("no match lists the given filters", async () => {
    const d = await list("--feature", "F5", "--label", "x");
    expect(d.code).toBe(0);
    expect(d.out).toEqual(["Aucun ticket pour ces filtres : --feature F5 --label x"]);
  });
});

describe("kibo tickets list --fields", () => {
  test("--fields key,status,sprint prints tab-separated columns in that order", async () => {
    const d = await list("--fields", "key,status,sprint", "--feature", "F7");
    expect(d.code).toBe(0);
    expect(d.out).toEqual(["key\tstatus\tsprint", "SILO-40\ttodo\t-", "SILO-41\twip\t-"]);
  });

  test("--fields with --json prints reduced objects", async () => {
    const d = await list("--fields", "key,feature,sprint", "--json", "--feature", "F5");
    expect(JSON.parse(d.out.join("\n"))).toEqual([
      { key: "SILO-30", feature: "F5", sprint: "S42" },
      { key: "SILO-33", feature: "F5", sprint: "S42" },
      { key: "SILO-34", feature: "F5", sprint: "S42" },
    ]);
  });

  test("an unknown field prints the usage with the field list", async () => {
    const d = await list("--fields", "key,colour");
    expect(d.code).toBe(2);
    expect(d.out).toEqual([]);
    expect(d.err[0]).toStartWith("Champ inconnu : colour. Champs : id, key,");
    expect(d.err[0]).toContain("sprint");
    expect(d.err.join("\n")).toContain("kibo tickets list --project");
  });
});
