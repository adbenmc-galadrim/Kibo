import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Agent,
  AgentsState,
  DeliverResult,
  DeliveryRpcRequest,
  ProjectMeta,
  ProjectSnapshot,
  RunView,
  Ticket,
  TicketView,
} from "@kibo/schema";
import { DELIVERY_RPC_METHODS } from "@kibo/schema";
import { type Kit, startKit, stopKits, waitFor } from "./agents-skills.test-helper";
import { scenarioPath } from "./runs/fake-claude-scenario";
import { repo } from "./testing/git-test-kit";

afterEach(stopKits);

const CLI = join(import.meta.dir, "..", "..", "cli", "src", "bin.ts");
const SLOTS = (home: string) => join(home, "slots");

type Silo = { kit: Kit; project: ProjectMeta; tickets: Map<string, Ticket>; agent: Agent };

async function silo(): Promise<Silo> {
  const kit = await startKit({
    scenario: scenarioPath("delivery-routes"),
    env: (home) => ({ KIBO_HOME: home, KIBO_CLI: CLI, DELIVERY_SLOTS: SLOTS(home) }),
  });
  const project = await kit.rpc<ProjectMeta>({
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: await repo(),
    color: "#F97316",
  });
  const tickets = new Map<string, Ticket>();
  const create = async (title: string, parentId?: string) => {
    const ticket = await kit.rpc<Ticket>({
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title, statusId: "todo", ...(parentId ? { parentId } : {}) },
    });
    tickets.set(ticket.key ?? title, ticket);
    return ticket;
  };
  for (let i = 1; i <= 18; i++) await create(`Ticket ${i}`);
  const parent = tickets.get("SILO-17");
  if (!parent) throw new Error("no SILO-17");
  await create("Sous-ticket C2-1", parent.id);
  await create("Sous-ticket C2-2", parent.id);
  const { agent } = await kit.rpc<{ agent: Agent }>({
    method: "agents.create",
    scope: "global",
    name: "full-delivery",
    description: "Livre un ticket de bout en bout",
    template: "blank",
  });
  await kit.rpc({ method: "agents.settings", ref: agent.ref, patch: { maxParallel: 3 } });
  return { kit, project, tickets, agent };
}

const idOf = (s: Silo, key: string): string => {
  const ticket = s.tickets.get(key);
  if (!ticket) throw new Error(`no ticket ${key}`);
  return ticket.id;
};

const _deliver = (s: Silo, key: string) =>
  s.kit.rpc<DeliverResult>({ method: "deliver", projectId: s.project.id, ticketId: idOf(s, key) });

const runOf = async (s: Silo, runId: string) =>
  (await s.kit.rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === runId);

const _runIn = (s: Silo, runId: string, states: readonly string[], turns = 1) =>
  waitFor(async () => {
    const run = await runOf(s, runId);
    return run && states.includes(run.state) && run.turns >= turns ? run : undefined;
  });

const snapshot = (s: Silo) => s.kit.rpc<ProjectSnapshot>({ method: "getProject", projectId: s.project.id });

const _ticketView = async (s: Silo, key: string): Promise<TicketView | undefined> =>
  (await snapshot(s)).tickets.find((t) => t.key === key);

const _runFrom = (result: DeliverResult): RunView => {
  if ("kind" in result && result.kind === "parent") throw new Error("expected a run");
  return result;
};

async function _cookie(kit: Kit): Promise<string> {
  const paired = await fetch(`${kit.daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: kit.daemon.url },
    body: JSON.stringify({ token: kit.daemon.token }),
  });
  return paired.headers.get("set-cookie")?.split(";")[0] ?? "";
}

test("setDeliveryStep refuse une étape hors de 0 à 11 et une note trop longue", async () => {
  const s = await silo();
  const step = (over: Record<string, unknown>) =>
    s.kit.raw({ method: "setDeliveryStep", projectId: s.project.id, ticketKey: "SILO-15", step: 7, ...over });
  expect(await step({ step: 12 })).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  expect(await step({ note: "x".repeat(301) })).toMatchObject({
    ok: false,
    error: { code: "INVALID_INPUT" },
  });
  expect(await step({ note: "porte qualité" })).toMatchObject({
    ok: true,
    result: { delivery: { step: 7 } },
  });
  const agents = await s.kit.rpc<AgentsState>({ method: "getAgents" });
  expect(agents.delivery).toEqual([]);
}, 60_000);

test("verrous de la machine et import du registre full-delivery", async () => {
  const s = await silo();
  const heavy = join(SLOTS(s.kit.home), "heavy");
  mkdirSync(join(heavy, "held"), { recursive: true });
  writeFileSync(join(heavy, "max"), "2");
  const held = {
    pid: process.pid,
    since: 1,
    label: "silo:SILO-15 gates",
    cwd: "/w",
    ticket: `1-${process.pid}`,
  };
  writeFileSync(join(heavy, "held", "1.json"), JSON.stringify(held));
  const locks = await waitFor(async () => {
    const state = await s.kit.rpc<AgentsState>({ method: "getAgents" });
    return (state.locks?.length ?? 0) > 0 ? state.locks : undefined;
  });
  expect(locks).toEqual([expect.objectContaining({ name: "heavy", max: 2 })]);
  const folder = s.project.folder ?? "";
  const registry = join(s.kit.home, "registry.json");
  const entry = { repo: folder, base: "dev", worktree: { dir: `${folder}-{dashed}` } };
  const proto = { repo: "/x", base: "main" };
  writeFileSync(
    registry,
    `{"projects":{"__proto__":${JSON.stringify(proto)},"silo":${JSON.stringify(entry)}}}`,
  );
  const imported = await s.kit.rpc<{ candidates: { name: string; matched: string | null }[] }>({
    method: "projects.importDelivery",
    registryPath: registry,
  });
  expect(imported.candidates.map((c) => [c.name, c.matched])).toEqual([["silo", s.project.id]]);
  const polluted = await s.kit.raw({
    method: "projects.applyDeliveryImport",
    projectId: s.project.id,
    name: "__proto__",
    registryPath: registry,
  });
  expect(polluted).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  expect(Object.prototype).not.toHaveProperty("repo");
  await s.kit.rpc({
    method: "projects.applyDeliveryImport",
    projectId: s.project.id,
    name: "silo",
    registryPath: registry,
  });
  const meta = (await snapshot(s)).meta;
  expect(meta.worktree?.baseRef).toBe("origin/dev");
  expect(meta.delivery).not.toBeNull();
}, 60_000);

test("chaque méthode de DELIVERY_RPC est servie par une extension du démon", async () => {
  const s = await silo();
  const registryPath = join(s.kit.home, "absent.json");
  const requests: { [M in DeliveryRpcRequest["method"]]: Extract<DeliveryRpcRequest, { method: M }> } = {
    "agents.applyPreset": { method: "agents.applyPreset", ref: s.agent.ref, preset: "delivery" },
    deliver: { method: "deliver", projectId: s.project.id, ticketId: idOf(s, "SILO-17") },
    setDeliveryStep: { method: "setDeliveryStep", projectId: s.project.id, ticketKey: "SILO-1", step: 1 },
    "runs.denials": { method: "runs.denials", runId: "absent" },
    "runs.allowAndResume": {
      method: "runs.allowAndResume",
      runId: "absent",
      questionId: "q",
      rules: [],
      addDirs: [],
    },
    "projects.importDelivery": { method: "projects.importDelivery", registryPath },
    "projects.applyDeliveryImport": {
      method: "projects.applyDeliveryImport",
      projectId: s.project.id,
      name: "silo",
      registryPath,
    },
    deliveryAgent: { method: "deliveryAgent", projectId: s.project.id },
  };
  expect(Object.keys(requests).sort()).toEqual([...DELIVERY_RPC_METHODS].sort());
  for (const req of Object.values(requests)) {
    const reply = await s.kit.raw(req);
    const error = reply.ok ? null : JSON.stringify(reply.error);
    expect({ method: req.method, error }).not.toMatchObject({ error: expect.stringContaining("INTERNAL") });
  }
}, 60_000);
