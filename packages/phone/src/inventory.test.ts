import { expect, test } from "bun:test";
import { join } from "node:path";
import { REMOTE_COMMAND_KINDS, REMOTE_METHODS } from "@kibo/remote";
import { ProjectCommand, RpcRequest } from "@kibo/schema";
import { Glob } from "bun";
import { EXCLUDED_NAMES, INVENTORY, SPEC_SCREENS } from "./inventory";
import { READ_LOCALLY, type SnapshotReader, serveLocally } from "./remote-reads";

const ROOT = join(import.meta.dir, "..", "..", "..");
const SCANNED = [
  "components/*/src/**/*.{ts,tsx}",
  "packages/ui/src/ticket/**/*.{ts,tsx}",
  "packages/ui/src/project-agent/**/*.{ts,tsx}",
  "packages/ui/src/shell/TicketDetail.tsx",
  "packages/ui/src/shell/sheet/**/*.{ts,tsx}",
];
const NOT_SHIPPED = /\.test\.|seed|fixture|kit|harness|test-helper/;
const COMMANDS: ReadonlySet<string> = new Set([...ProjectCommand.innerType().optionsMap.keys()].map(String));
const METHODS: ReadonlySet<string> = new Set([...RpcRequest.optionsMap.keys()].map(String));
const RELAYED_COMMANDS: ReadonlySet<string> = new Set(REMOTE_COMMAND_KINDS);
const RELAYED_METHODS: ReadonlySet<string> = new Set(REMOTE_METHODS);
const LOCAL_METHODS: ReadonlySet<string> = new Set(READ_LOCALLY);

async function shippedSources(): Promise<string[]> {
  const files: string[] = [];
  for (const pattern of SCANNED)
    for await (const file of new Glob(pattern).scan(ROOT)) if (!NOT_SHIPPED.test(file)) files.push(file);
  return files;
}

async function namesUsed(): Promise<{ commands: Set<string>; methods: Set<string> }> {
  const commands = new Set<string>();
  const methods = new Set<string>();
  for (const file of await shippedSources()) {
    const text = await Bun.file(join(ROOT, file)).text();
    for (const [, name = ""] of text.matchAll(/method:\s*"([\w.]+)"/g)) {
      if (COMMANDS.has(name)) commands.add(name);
      else if (METHODS.has(name)) methods.add(name);
    }
  }
  return { commands, methods };
}

test("every excluded entry has a reason", () => {
  const excluded = INVENTORY.filter((entry) => entry.phone === "excluded");
  expect(excluded.length).toBeGreaterThan(0);
  for (const entry of excluded) expect(entry.reason.trim()).not.toBe("");
});

test("every command kind found in components/*/src and packages/ui/src/{ticket,project-agent,shell/TicketDetail.tsx,shell/sheet} is in REMOTE_COMMAND_KINDS or named by an excluded entry", async () => {
  const { commands } = await namesUsed();
  expect(commands.size).toBeGreaterThan(10);
  const unclassified = [...commands].filter((c) => !RELAYED_COMMANDS.has(c) && !EXCLUDED_NAMES.has(c));
  expect(unclassified).toEqual([]);
});

test("every command of the schema is relayed or named by an excluded entry", () => {
  const unclassified = [...COMMANDS].filter((c) => !RELAYED_COMMANDS.has(c) && !EXCLUDED_NAMES.has(c));
  expect(unclassified).toEqual([]);
});

test("every RPC method found there is in REMOTE_METHODS, served locally by remote-client (READ_LOCALLY list) or named by an excluded entry", async () => {
  const { methods } = await namesUsed();
  expect(methods).toContain("getProjectAgent");
  const unclassified = [...methods].filter(
    (m) => !RELAYED_METHODS.has(m) && !LOCAL_METHODS.has(m) && !EXCLUDED_NAMES.has(m),
  );
  expect(unclassified).toEqual([]);
});

test("an excluded name is never relayed: the closed list and the inventory agree", () => {
  const both = [...EXCLUDED_NAMES].filter((n) => RELAYED_COMMANDS.has(n) || RELAYED_METHODS.has(n));
  expect(both).toEqual([]);
});

test("every READ_LOCALLY method is answered from the blocks, without the Mac", async () => {
  const reader: SnapshotReader = {
    index: async () => ({ viewer: "adam", projects: [] }),
    open: async (_projectId, kind) =>
      kind === "agent"
        ? { view: { session: null, run: null, batches: [], past: [], memoryPath: null }, logs: {} }
        : kind === "t3"
          ? { state: "ready" }
          : { meta: {}, workflow: [], tickets: [], questionRecipients: [] },
    has: (_projectId, kind) => kind !== "events" && kind !== "ci",
    projectIds: () => ["silo"],
  };
  const deps = {
    reader,
    data: { get: () => null, set: () => {}, delete: () => {}, keys: () => [] },
    today: () => "2026-10-16",
  };
  const requests = READ_LOCALLY.map((method) =>
    RpcRequest.parse(
      {
        getSession: { method },
        listProjects: { method },
        getProject: { method, projectId: "silo" },
        listProjectEvents: { method, projectId: "silo" },
        listCiRuns: { method, projectId: "silo", ticketId: null },
        getProjectAgent: { method, projectId: "silo" },
        getRunLog: { method, runId: "r1" },
        "t3.status": { method },
      }[method],
    ),
  );
  for (const req of requests) expect(await serveLocally(deps, req)).not.toBeNull();
});

test("every screen of the spec is present (graph, kanban, planning, dashboard, ticket, questions, agent)", () => {
  expect(SPEC_SCREENS.map(String).sort()).toEqual(
    ["agent", "dashboard", "graph", "kanban", "planning", "questions", "ticket"].sort(),
  );
  for (const screen of SPEC_SCREENS) {
    const kept = INVENTORY.filter((entry) => entry.screen === screen && entry.phone !== "excluded");
    expect(kept.length).toBeGreaterThan(0);
  }
});

test("no entry is excluded on graph except the dependency arrows", () => {
  const excluded = INVENTORY.filter((entry) => entry.screen === "graph" && entry.phone === "excluded");
  expect(excluded.map((entry) => entry.feature)).toEqual(["flèches de dépendance"]);
});
