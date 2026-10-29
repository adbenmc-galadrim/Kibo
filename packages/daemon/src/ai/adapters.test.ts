import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ComponentManifest,
  type ComponentSummary,
  type ComponentVersionSummary,
  type IntegrationStatus,
  type RunState,
} from "@kibo/schema";
import {
  catalogEntries,
  createExecPort,
  githubConnected,
  kiboShimArgv,
  latestPublished,
  type RunLike,
  runsFromOrchestrator,
  usagesOf,
  writeKiboShim,
} from "./adapters";
import { BUILTIN_STARTERS } from "./builtin-starters";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("createExecPort", () => {
  test("runs a binary with the given environment", async () => {
    const exec = createExecPort({ PATH: process.env.PATH, KIBO_PROBE: "yes" });
    const r = await exec(["sh", "-c", "echo $KIBO_PROBE"], 10_000);
    expect(r).toEqual({ code: 0, stdout: "yes\n", stderr: "" });
  });
  test("returns null for a missing binary", async () => {
    expect(await createExecPort(process.env)(["kibo-definitely-missing-binary"], 1_000)).toBeNull();
    expect(await createExecPort(process.env)(["/nonexistent/claude", "--version"], 1_000)).toBeNull();
  });
  test("returns null for a file that cannot be executed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kibo-exec-"));
    roots.push(dir);
    writeFileSync(join(dir, "claude"), "#!/bin/sh\n", { mode: 0o644 });
    expect(await createExecPort(process.env)([join(dir, "claude"), "--version"], 1_000)).toBeNull();
  });
  test("rethrows any other launch failure", async () => {
    await expect(createExecPort(process.env)(["sh", "-c", "a\0b"], 1_000)).rejects.toMatchObject({
      code: "ERR_INVALID_ARG_VALUE",
    });
  });
});

describe("kibo shim", () => {
  test("the compiled binary is its own CLI, dev runs the CLI sources", () => {
    expect(kiboShimArgv({ compiled: true, execPath: "/Applications/Kibo.app/kibo" })).toEqual([
      "/Applications/Kibo.app/kibo",
    ]);
    const dev = kiboShimArgv({ compiled: false, execPath: "/usr/local/bin/bun" });
    expect(dev[0]).toBe("/usr/local/bin/bun");
    expect(dev[1]).toEndWith(join("packages", "cli", "src", "bin.ts"));
    expect(statSync(dev[1] ?? "").isFile()).toBe(true);
  });
  test("writeKiboShim forwards its arguments", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kibo-shim-"));
    roots.push(dir);
    writeKiboShim(dir, ["echo", "kibo's"]);
    expect(statSync(join(dir, "kibo")).mode & 0o777).toBe(0o700);
    const r = await createExecPort(process.env)(["sh", join(dir, "kibo"), "component", "test", "."], 5_000);
    expect(r?.stdout).toBe("kibo's component test .\n");
  });
});

function fakeOrchestrator() {
  const runs = new Map<string, RunLike>();
  const listeners = new Set<(r: RunLike) => void>();
  const cancelled: string[] = [];
  const view = (id: string, state: RunState, output: string | null = null): RunLike => ({
    id,
    state,
    sessionId: "s1",
    error: state === "failed" ? "exit 1" : null,
    output,
  });
  const emit = (run: RunLike) => {
    runs.set(run.id, run);
    for (const l of [...listeners]) l(run);
  };
  const o = {
    cancel: (id: string) => {
      cancelled.push(id);
      emit(view(id, "cancelled"));
    },
    state: () => ({ runs: [...runs.values()] }),
    onRunState: (l: (r: RunLike) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
  return { o, cancelled, view, emit };
}

describe("runsFromOrchestrator", () => {
  const request = {
    profileId: "system:generateur" as const,
    label: "Composant Burndown",
    cwd: "/tmp/draft",
    prompt: "p",
    args: ["--tools", "Read"],
    env: { PATH: "/kibo/bin" },
    resumeSessionId: null,
    guard: () => ({ decision: "allow" }) as const,
  };

  test("a component draft is refused: Kibo no longer runs ticket agents", () => {
    expect(() => runsFromOrchestrator(fakeOrchestrator().o).enqueue(request)).toThrow(
      "AGENT_EXECUTION_REMOVED",
    );
  });

  test("end events fire once, late subscribers get the result, output becomes stdout", () => {
    const f = fakeOrchestrator();
    const ports = runsFromOrchestrator(f.o);
    const runId = "r1";
    f.emit(f.view(runId, "queued"));
    const ends: string[] = [];
    ports.onEnd(runId, (e) => ends.push(`${e.state}:${e.stdout}`));
    f.emit(f.view(runId, "running"));
    f.emit(f.view(runId, "done", '{"type":"result"}'));
    f.emit(f.view(runId, "done", '{"type":"result"}'));
    ports.onEnd(runId, (e) => ends.push(`late:${e.state}`));
    expect(ends).toEqual(['done:{"type":"result"}', "late:done"]);
    expect(ports.state(runId)).toBe("done");
    expect(ports.state("unknown")).toBeNull();
  });

  test("state listeners only hear their run", () => {
    const f = fakeOrchestrator();
    const ports = runsFromOrchestrator(f.o);
    const states: RunState[] = [];
    const off = ports.onState("r1", (s) => states.push(s));
    f.emit(f.view("r2", "running"));
    f.emit(f.view("r1", "running"));
    off();
    f.emit(f.view("r1", "done"));
    expect(states).toEqual(["running"]);
  });

  test("cancel of a finished or unknown run does nothing", () => {
    const f = fakeOrchestrator();
    const ports = runsFromOrchestrator(f.o);
    f.emit(f.view("r1", "done"));
    ports.cancel("r1");
    ports.cancel("unknown");
    expect(f.cancelled).toEqual([]);
    f.emit(f.view("r2", "running"));
    ports.cancel("r2");
    expect(f.cancelled).toEqual(["r2"]);
  });
});

const burndown = (version: string) =>
  ComponentManifest.parse({
    id: "burndown",
    version,
    kind: "widget",
    title: "Burndown",
    reads: ["ticket"],
    writes: [],
  });

const version = (v: Partial<ComponentVersionSummary> & { version: string }): ComponentVersionSummary => ({
  hash: "a".repeat(64),
  trust: "sandboxed",
  origin: "ai",
  active: true,
  tampered: false,
  manifest: burndown(v.version),
  usages: [],
  revoked: null,
  backend: false,
  ...v,
});

const builtin = (id: string): ComponentSummary => ({
  id,
  title: id,
  builtin: true,
  versions: [version({ version: "1.0.0", hash: null, trust: "builtin", origin: "kibo", manifest: null })],
});

describe("catalog helpers", () => {
  const list: ComponentSummary[] = [
    builtin("kanban"),
    builtin("mcp-source"),
    {
      id: "burndown",
      title: "Burndown",
      builtin: false,
      versions: [
        version({
          version: "0.1.0",
          usages: [
            { projectId: "p1", projectName: "Kibo", pageId: "pg1", pageTitle: "Sprint", instanceId: "i1" },
          ],
        }),
        version({ version: "0.2.0", active: false, hash: "b".repeat(64) }),
      ],
    },
    {
      id: "sync-jira",
      title: "Jira",
      builtin: false,
      versions: [
        version({
          version: "1.0.0",
          manifest: ComponentManifest.parse({
            id: "sync-jira",
            version: "1.0.0",
            kind: "adapter",
            title: "Jira",
            reads: [],
            writes: [],
          }),
        }),
      ],
    },
    {
      id: "pending",
      title: "Pending",
      builtin: false,
      versions: [version({ version: "0.1.0", active: false })],
    },
  ];

  test("catalogEntries lists the built-in starters and the active user components", () => {
    expect(catalogEntries(list)).toEqual([
      ...BUILTIN_STARTERS,
      { id: "burndown", title: "Burndown", description: "", kind: "widget" },
    ]);
    expect(BUILTIN_STARTERS.map((e) => e.id)).toEqual(["kanban", "tickets", "graph", "notes"]);
  });

  test("the built-in starters match the manifests of the built-in components", () => {
    for (const entry of BUILTIN_STARTERS) {
      const path = join(
        import.meta.dir,
        "..",
        "..",
        "..",
        "..",
        "components",
        entry.id,
        "kibo.component.json",
      );
      const m = ComponentManifest.parse(JSON.parse(readFileSync(path, "utf8")));
      expect(entry).toEqual({ id: m.id, title: m.title, description: m.description ?? "", kind: entry.kind });
      expect(m.kind).toBe(entry.kind);
    }
  });

  test("latestPublished returns the highest version with its hash and granted permissions", () => {
    expect(latestPublished(list, "burndown")).toMatchObject({
      version: "0.2.0",
      origin: "ai",
      hash: "b".repeat(64),
      granted: { reads: [] },
    });
    expect(latestPublished(list, "kanban")).toBeNull();
    expect(latestPublished(list, "nope")).toBeNull();
  });

  test("usagesOf tags each usage with its version", () => {
    expect(usagesOf(list, "burndown")).toEqual([
      {
        projectId: "p1",
        projectName: "Kibo",
        pageId: "pg1",
        pageTitle: "Sprint",
        instanceId: "i1",
        version: "0.1.0",
      },
    ]);
  });

  test("githubConnected", () => {
    const base = { account: null, servers: [], error: null, resumeAt: null };
    const status = (state: IntegrationStatus["state"]): IntegrationStatus => ({
      ...base,
      id: "github",
      state,
    });
    expect(githubConnected([status("connected")])).toBe(true);
    expect(githubConnected([status("disconnected")])).toBe(false);
    expect(githubConnected([])).toBe(false);
  });
});
