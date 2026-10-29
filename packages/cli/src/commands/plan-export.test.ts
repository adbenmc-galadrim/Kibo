import { describe, expect, test } from "bun:test";
import { parseArgs } from "../args";
import { planMarkdown } from "../plan/plan-markdown";
import { planCommand } from "./plan";
import { fakeDaemon, fakeSnapshot, SILO_META } from "./tickets-test-kit";

async function exportWith(args: string[], d = fakeDaemon()) {
  const { positional, flags } = parseArgs(["plan", "export", ...args]);
  const code = await planCommand(positional.slice(1), flags, d.io, d.connect);
  return { ...d, code };
}

describe("kibo plan export", () => {
  test("writes the markdown to stdout", async () => {
    const d = await exportWith(["--md", "--project", "SILO"]);
    expect(d.code).toBe(0);
    expect(d.err).toEqual([]);
    expect(d.out).toEqual([planMarkdown(fakeSnapshot()).trimEnd()]);
    expect(d.out[0]).toStartWith("# SILO · Silo\n\n## S42 · Saisie hors ligne");
    expect(d.commands()).toEqual([]);
    expect(d.closed()).toBe(1);
  });

  test("--md can be left out", async () => {
    const d = await exportWith(["--project", "silo"]);
    expect(d.code).toBe(0);
    expect(d.out).toEqual([planMarkdown(fakeSnapshot()).trimEnd()]);
  });

  test("--project is required", async () => {
    const d = await exportWith(["--md"]);
    expect(d.code).toBe(2);
    expect(d.err).toEqual(["précise --project SILO"]);
    const valueless = await exportWith(["--project"]);
    expect(valueless.code).toBe(2);
    expect(valueless.err.join("\n")).toContain("kibo plan export");
  });

  test("an unknown project is an error", async () => {
    const d = await exportWith(
      ["--project", "PFD"],
      fakeDaemon(undefined, undefined, { projects: [SILO_META] }),
    );
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Projet introuvable : PFD"]);
  });
});
