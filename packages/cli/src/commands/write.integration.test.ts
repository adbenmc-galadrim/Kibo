import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@kibo/daemon/daemon";
import { PlanOutcome, PlanPreview } from "@kibo/schema";
import { connectDaemon, type DaemonClient } from "../daemon-client";
import { runCli } from "../index";

const PLAN_EXAMPLE = join(import.meta.dir, "../../../../docs/cli-plan-exemple.yaml");

describe("kibo writes against a real daemon", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-write-"));
  const out: string[] = [];
  const err: string[] = [];
  const io = {
    home,
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  };
  let stop: () => Promise<void> = async () => {};
  let seed: DaemonClient;
  let projectId = "";

  async function run(...argv: string[]): Promise<number> {
    out.length = 0;
    err.length = 0;
    return runCli(argv, io);
  }

  async function json(...argv: string[]): Promise<Record<string, unknown>> {
    expect(await run(...argv, "--json")).toBe(0);
    return JSON.parse(out.join("\n"));
  }

  const keysOf = (refs: unknown): string[] =>
    Array.isArray(refs) ? refs.map((r: { key: string }) => r.key) : [];

  async function viewOf(key: string) {
    const snapshot = await seed.rpc({ method: "getProject", projectId });
    const view = snapshot.tickets.find((t) => t.key === key);
    if (view === undefined) throw new Error(`no ticket ${key}`);
    return view;
  }

  beforeAll(async () => {
    const daemon = await startDaemon({
      home,
      port: 0,
      sandboxPort: 0,
      uiDir: null,
      dev: false,
      user: "adam",
      integrations: { testOrigins: [], memorySecrets: true },
    });
    stop = async () => daemon.stop();
    seed = await connectDaemon(home);
    projectId = (
      await seed.rpc({ method: "createProject", name: "Silo", key: "SILO", folder: null, color: "#336699" })
    ).id;
  }, 120_000);

  afterAll(async () => {
    await seed.close();
    await stop();
    rmSync(home, { recursive: true, force: true });
  });

  test("creates a sprint, a feature and its steps", async () => {
    expect(
      await run(
        "sprints",
        "create",
        "S1",
        "--start",
        "2026-11-02",
        "--end",
        "2026-11-13",
        "--project",
        "SILO",
      ),
    ).toBe(0);
    const feature = await json(
      "features",
      "create",
      "Import des relevés",
      "--sprint",
      "S1",
      "--project",
      "SILO",
    );
    expect(feature).toMatchObject({ key: "F1", parent: null, sprint: { code: "S1" } });
    const first = await json("tickets", "create", "Lire le fichier", "--feature", "F1", "--project", "SILO");
    expect(first).toMatchObject({ key: "SILO-1", feature: { shortKey: "F1" }, sprint: { code: "S1" } });
    const second = await json(
      "tickets",
      "create",
      "Contrôler les lignes",
      "--feature",
      "F1",
      "--optional",
      "--project",
      "SILO",
    );
    expect(second).toMatchObject({ key: "SILO-2", optional: true });
  });

  test("link A --blocks B makes B wait for A", async () => {
    expect(await run("tickets", "link", "SILO-1", "--blocks", "SILO-2")).toBe(0);
    expect(keysOf((await json("tickets", "get", "SILO-2")).deps)).toEqual(["SILO-1"]);
    expect((await viewOf("SILO-2")).waitingOn).toEqual(["SILO-1"]);
    expect((await viewOf("SILO-1")).waitingOn).toEqual([]);
  });

  test("--append adds a paragraph to the description", async () => {
    expect(await run("tickets", "update", "SILO-1", "--append", "Détail")).toBe(0);
    expect((await json("tickets", "get", "SILO-1")).description).toBe("Détail");
    expect(await run("tickets", "update", "SILO-1", "--append", "Suite")).toBe(0);
    expect((await json("tickets", "get", "SILO-1")).description).toBe("Détail\n\nSuite");
  });

  test("a sprint on a step is refused with what to do", async () => {
    expect(await run("sprints", "assign", "SILO-1", "S1", "--project", "SILO")).toBe(1);
    expect(err).toEqual(["Le sprint d'une étape vient de sa fonctionnalité : posez S1 sur F1."]);
  });

  test("asks and answers a question", async () => {
    expect(await run("questions", "add", "SILO-1", "Format ?", "--option", "CSV", "--option", "XLSX")).toBe(
      0,
    );
    const answered = await json("questions", "answer", "1", "CSV", "--project", "SILO");
    expect(answered).toMatchObject({ number: 1, answer: { kind: "option", option: "CSV" } });
  });

  test("the example plan is previewed, then applied with the predicted keys", async () => {
    expect(await run("plan", "apply", PLAN_EXAMPLE, "--dry-run", "--project", "SILO")).toBe(0);
    expect(out.at(-1)).toBe("10 actions, rien n'est écrit (--dry-run).");
    const preview = PlanPreview.parse(
      await json("plan", "apply", PLAN_EXAMPLE, "--dry-run", "--project", "SILO"),
    );
    if (!preview.ok) throw new Error(JSON.stringify(preview.problems));
    expect(preview.keys).toEqual({ "new:1": "F2", "new:2": "SILO-3", "new:3": "SILO-4", "new:4": "SILO-5" });
    expect((await seed.rpc({ method: "getProject", projectId })).tickets).toHaveLength(3);
    const outcome = PlanOutcome.parse(await json("plan", "apply", PLAN_EXAMPLE, "--project", "SILO"));
    expect(outcome.stoppedAt).toBeNull();
    const created: Record<string, string | null> = Object.fromEntries(
      outcome.created.map((c) => [c.ref, c.key]),
    );
    expect(created).toEqual(preview.keys);
    expect((await viewOf("SILO-4")).waitingOn).toEqual(["SILO-3"]);
    expect((await viewOf("SILO-5")).waitingOn).toEqual(["SILO-4"]);
    const sprint = (await seed.rpc({ method: "getProject", projectId })).sprints.find((s) => s.code === "S2");
    expect((await viewOf("SILO-3")).effectiveSprintId).toBe(sprint?.id ?? "none");
  });

  test("plan export writes the plan in Markdown", async () => {
    expect(await run("plan", "export", "--project", "SILO")).toBe(0);
    const markdown = out.join("\n");
    expect(markdown).toContain("## S1");
    expect(markdown).toContain("### F1");
    expect(markdown).toContain("- [ ] SILO-1");
  });

  test("rpc sends a raw request", async () => {
    expect(await run("rpc", '{"method":"listProjects"}')).toBe(0);
    const projects: unknown = JSON.parse(out.join("\n"));
    expect(projects).toEqual(expect.arrayContaining([expect.objectContaining({ key: "SILO" })]));
  });

  test("unlink removes the dependency", async () => {
    expect(await run("tickets", "unlink", "SILO-1", "SILO-2")).toBe(0);
    expect(keysOf((await json("tickets", "get", "SILO-2")).deps)).toEqual([]);
  });

  test("the pairing token never shows", async () => {
    const token = readFileSync(join(home, "token"), "utf8").trim();
    expect(await run("rpc", '{"method":"listProjects"}')).toBe(0);
    expect(token.length).toBeGreaterThan(0);
    expect([...out, ...err].join("\n")).not.toContain(token);
  });
});
