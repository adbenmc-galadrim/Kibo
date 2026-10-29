import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import type { Parsed } from "../args";
import { explainError } from "../error-text";
import { fr } from "../fr";
import { featuresCommand } from "./features";
import { type FakeDaemonOptions, fakeDaemon } from "./tickets-test-kit";

const dir = mkdtempSync(join(tmpdir(), "kibo-features-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function features(
  positional: string[],
  flags: Parsed["flags"] = { project: "SILO" },
  options: FakeDaemonOptions = {},
  stdin = () => "",
) {
  const d = fakeDaemon(undefined, undefined, options);
  const code = await featuresCommand(positional, flags, d.io, d.connect, dir, stdin);
  return { ...d, code };
}

describe("kibo features create", () => {
  test("creates a feature and prints its key", async () => {
    const d = await features(["create", "Tournée et dépôt"]);
    expect(d.code).toBe(0);
    expect(d.commands()).toEqual([
      {
        method: "createTicket",
        title: "Tournée et dépôt",
        feature: true,
        description: undefined,
        labels: undefined,
      },
    ]);
    expect(d.calls.find((c) => c.method === "command")).toMatchObject({ projectId: "p-silo" });
    expect(d.out).toEqual(["✓ F1 créée : Tournée et dépôt"]);
    expect(d.err).toEqual([]);
    expect(d.closed()).toBe(1);
  });

  test("--sprint S43 chains setTicketSprint on the new feature", async () => {
    const d = await features(["create", "Tournée et dépôt"], { project: "SILO", sprint: "s43" });
    expect(d.commands()).toEqual([
      expect.objectContaining({ method: "createTicket", feature: true }),
      { method: "setTicketSprint", ticketId: "t-1", sprintId: "s43" },
    ]);
    expect(d.out).toEqual(["✓ F1 créée : Tournée et dépôt · S43"]);
  });

  test("--sprint by name, and an unknown sprint writes nothing", async () => {
    const named = await features(["create", "T"], { project: "SILO", sprint: "accès" });
    expect(named.commands().at(-1)).toEqual({ method: "setTicketSprint", ticketId: "t-1", sprintId: "s41" });
    const unknown = await features(["create", "T"], { project: "SILO", sprint: "S99" });
    expect(unknown.code).toBe(1);
    expect(unknown.err).toEqual(["Sprint introuvable : S99"]);
    expect(unknown.commands()).toEqual([]);
  });

  test("--description @file reads the file, --labels splits", async () => {
    writeFileSync(join(dir, "f.md"), "Livrer la tournée.\n");
    const d = await features(["create", "Tournée"], {
      project: "SILO",
      description: "@f.md",
      labels: "terrain, hors-ligne",
    });
    expect(d.commands()).toEqual([
      {
        method: "createTicket",
        title: "Tournée",
        feature: true,
        description: "Livrer la tournée.\n",
        labels: ["terrain", "hors-ligne"],
      },
    ]);
  });

  test('--description @- reads the standard input, --labels "" sends no label', async () => {
    const d = await features(
      ["create", "Tournée"],
      { project: "SILO", description: "@-", labels: "" },
      {},
      () => "Depuis stdin",
    );
    expect(d.commands()).toEqual([expect.objectContaining({ description: "Depuis stdin", labels: [] })]);
  });

  test("--json prints the created ticket in list form", async () => {
    const d = await features(["create", "Tournée et dépôt"], { project: "SILO", json: true });
    expect(d.code).toBe(0);
    const printed = JSON.parse(d.out.join("\n"));
    expect(printed).toMatchObject({ id: "t-1", key: "SILO-101", title: "Tournée et dépôt" });
    expect(d.calls.filter((c) => c.method === "getProject")).toHaveLength(2);
  });

  test("without --project and outside a project folder it asks for the project", async () => {
    const d = await features(["create", "Tournée"], {});
    expect(d.code).toBe(2);
    expect(d.err).toEqual(["précise --project SILO"]);
    expect(d.commands()).toEqual([]);
  });

  test("a missing title, an unknown subcommand or a bare flag is a usage error", async () => {
    for (const [positional, flags] of [
      [["create"], { project: "SILO" }],
      [["nope", "T"], { project: "SILO" }],
      [[], {}],
      [["create", "T"], { project: "SILO", sprint: true }],
      [["create", "T"], { project: "SILO", labels: true }],
    ] as const) {
      const d = await features([...positional], { ...flags });
      expect(d.code).toBe(2);
      expect(d.err.at(-1)).toContain("kibo features create");
      expect(d.calls).toEqual([]);
    }
  });

  test("a domain error goes up untouched to the error printer", async () => {
    const run = features(
      ["create", " "],
      { project: "SILO" },
      {
        onCommand: () => {
          throw new KiboError("INVALID_INPUT", "ticket title is empty");
        },
      },
    );
    const e = await run.then(
      () => null,
      (error: unknown) => error,
    );
    if (!(e instanceof KiboError)) throw new Error("expected a KiboError");
    expect(explainError(e)).toBeNull();
    expect(fr.error(e.code, e.detail)).toBe("Erreur INVALID_INPUT : ticket title is empty");
  });
});
