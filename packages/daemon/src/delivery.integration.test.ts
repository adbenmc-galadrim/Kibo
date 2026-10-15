import { afterEach, expect, test } from "bun:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Agent,
  AgentsState,
  DeliverResult,
  DeliveryAgent,
  DeliveryRpcRequest,
  ProjectMeta,
  ProjectSnapshot,
  Question,
  RunDenials,
  RunMomentsPage,
  RunSubagent,
  RunView,
  Ticket,
  TicketView,
} from "@kibo/schema";
import { DELIVERY_RPC_METHODS } from "@kibo/schema";
import { fakeCalls, releaseFakeRun, scenarioPath } from "./agents/fake-claude-scenario";
import { repo } from "./agents/git-test-kit";
import { actions, type Kit, startKit, stopKits, waitFor } from "./agents-skills.test-helper";

afterEach(stopKits);

const CLI = join(import.meta.dir, "..", "..", "cli", "src", "bin.ts");
const SLOTS = (home: string) => join(home, "slots");

type Emis = { kit: Kit; project: ProjectMeta; tickets: Map<string, Ticket>; agent: Agent };

async function emis(): Promise<Emis> {
  const kit = await startKit({
    scenario: scenarioPath("delivery-routes"),
    env: (home) => ({ KIBO_HOME: home, KIBO_CLI: CLI, DELIVERY_SLOTS: SLOTS(home) }),
  });
  const project = await kit.rpc<ProjectMeta>({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
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
  const parent = tickets.get("EMIS-17");
  if (!parent) throw new Error("no EMIS-17");
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

const idOf = (s: Emis, key: string): string => {
  const ticket = s.tickets.get(key);
  if (!ticket) throw new Error(`no ticket ${key}`);
  return ticket.id;
};

const deliver = (s: Emis, key: string) =>
  s.kit.rpc<DeliverResult>({ method: "deliver", projectId: s.project.id, ticketId: idOf(s, key) });

const runOf = async (s: Emis, runId: string) =>
  (await s.kit.rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === runId);

const runIn = (s: Emis, runId: string, states: readonly string[], turns = 1) =>
  waitFor(async () => {
    const run = await runOf(s, runId);
    return run && states.includes(run.state) && run.turns >= turns ? run : undefined;
  });

const snapshot = (s: Emis) => s.kit.rpc<ProjectSnapshot>({ method: "getProject", projectId: s.project.id });

const ticketView = async (s: Emis, key: string): Promise<TicketView | undefined> =>
  (await snapshot(s)).tickets.find((t) => t.key === key);

const runFrom = (result: DeliverResult): RunView => {
  if ("kind" in result && result.kind === "parent") throw new Error("expected a run");
  return result;
};

async function cookie(kit: Kit): Promise<string> {
  const paired = await fetch(`${kit.daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: kit.daemon.url },
    body: JSON.stringify({ token: kit.daemon.token }),
  });
  return paired.headers.get("set-cookie")?.split(";")[0] ?? "";
}

test("Livrer EMIS-15 : la CLI du run pose les étapes, la capture est servie, « Valider » relance jusqu'à 11", async () => {
  const s = await emis();
  const run = runFrom(await deliver(s, "EMIS-15"));
  expect(run.brief).toBe("/full-delivery EMIS-15");
  expect(run.profileId).toBe(s.agent.ref);
  await runIn(s, run.id, ["waiting_input"]);
  expect((await ticketView(s, "EMIS-15"))?.delivery).toMatchObject({
    step: 7,
    note: "porte qualité",
    runId: run.id,
  });
  const question = await waitFor(async () =>
    (await snapshot(s)).questions.find((q: Question) => q.kind === "validation"),
  );
  const [image] = question.images;
  if (!image) throw new Error("no image");
  const url = `${s.kit.daemon.url}/api/questions/${question.id}/images/${image.id}`;
  const served = await fetch(url, { headers: { cookie: await cookie(s.kit), origin: s.kit.daemon.url } });
  expect(served.status).toBe(200);
  expect(served.headers.get("content-type")).toBe("image/png");
  expect((await fetch(url)).status).toBe(401);
  await s.kit.rpc({
    method: "command",
    projectId: s.project.id,
    command: {
      method: "answerQuestion",
      questionId: question.id,
      answer: { kind: "option", option: "Valider" },
      by: { kind: "human", ref: "adam" },
    },
  });
  await runIn(s, run.id, ["done"], 2);
  expect((await ticketView(s, "EMIS-15"))?.delivery).toMatchObject({ step: 11, note: "PR #12" });
}, 90_000);

test("un ticket parent rend ses sous-tickets sans run, et aucun agent ne le lance", async () => {
  const s = await emis();
  const result = await deliver(s, "EMIS-17");
  expect(result).toMatchObject({ kind: "parent" });
  if (!("kind" in result) || result.kind !== "parent") throw new Error("expected the sub-tickets");
  expect(result.items.map((i) => i.key)).toEqual(["EMIS-19", "EMIS-20"]);
  expect((await s.kit.rpc<AgentsState>({ method: "getAgents" })).runs).toEqual([]);
  const assigned = await s.kit.raw({
    method: "assignAgent",
    projectId: s.project.id,
    ticketId: idOf(s, "EMIS-17"),
    profileId: s.agent.ref,
    brief: "relis",
  });
  expect(assigned).toMatchObject({ ok: false, error: { code: "TICKET_HAS_CHILDREN" } });
  expect(await s.kit.rpc<DeliveryAgent | null>({ method: "deliveryAgent", projectId: s.project.id })).toEqual(
    {
      ref: s.agent.ref,
      name: "full-delivery",
    },
  );
}, 60_000);

test("setDeliveryStep refuse une étape hors de 0 à 11 et une note trop longue", async () => {
  const s = await emis();
  const step = (over: Record<string, unknown>) =>
    s.kit.raw({ method: "setDeliveryStep", projectId: s.project.id, ticketKey: "EMIS-15", step: 7, ...over });
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

test("des refus de Claude Code deviennent une question, « Autoriser et relancer » relance le run", async () => {
  const s = await emis();
  const skills = join(s.kit.home, ".claude", "skills");
  mkdirSync(skills, { recursive: true });
  const run = runFrom(await deliver(s, "EMIS-16"));
  await runIn(s, run.id, ["done"]);
  const denials = await waitFor(async () => {
    const found = await s.kit.rpc<RunDenials | null>({ method: "runs.denials", runId: run.id });
    return found ?? undefined;
  });
  const question = (await snapshot(s)).questions.find((q) => q.id === denials.questionId);
  expect(question?.title).toBe("3 actions refusées pendant le run");
  expect(denials.items.map((i) => i.rule ?? i.addDir ?? i.reason)).toEqual(["Bash(pnpm *)", skills, "shell"]);
  const allowed = await s.kit.rpc<{ agent: Agent; run: RunView }>({
    method: "runs.allowAndResume",
    runId: run.id,
    questionId: denials.questionId,
    rules: ["Bash(pnpm *)"],
    addDirs: [skills],
  });
  expect(allowed.agent.settings.allow).toContain("Bash(pnpm *)");
  expect(["queued", "starting", "running"]).toContain(allowed.run.state);
  await runIn(s, run.id, ["done"], 2);
  const page = await s.kit.rpc<RunMomentsPage>({ method: "runMoments", runId: run.id });
  expect(actions(page).some((a) => a.label.includes("echo resumed"))).toBe(true);
  const answered = (await snapshot(s)).questions.find((q) => q.id === denials.questionId);
  expect(answered?.answer).toMatchObject({
    text: `Autorisé : Bash(pnpm *) ; ${skills}`,
    deliveredRunId: run.id,
  });
  const again = await s.kit.raw({
    method: "runs.allowAndResume",
    runId: run.id,
    questionId: denials.questionId,
    rules: ["Bash(pnpm *)"],
    addDirs: [],
  });
  expect(again).toMatchObject({ ok: false, error: { code: "INVALID_TRANSITION" } });
  const preset = await s.kit.rpc<Agent>({
    method: "agents.applyPreset",
    ref: s.agent.ref,
    preset: "delivery",
  });
  expect(preset.settings).toMatchObject({ permissionMode: "auto", addDirs: [skills] });
  const second = runFrom(await deliver(s, "EMIS-13"));
  await runIn(s, second.id, ["done"]);
  const argv = fakeCalls(join(s.kit.home, "fake", "projects"), second.sessionId)[0]?.argv ?? [];
  expect(argv[argv.indexOf("--add-dir") + 1]).toBe(realpathSync(skills));
}, 90_000);

test("les sous-agents d'un run de livraison ont chacun leur ligne, hors du fil principal", async () => {
  const s = await emis();
  await s.kit.rpc({ method: "agents.settings", ref: s.agent.ref, patch: { allSubagents: true } });
  const run = runFrom(await deliver(s, "EMIS-18"));
  const running = await waitFor(async () => {
    const list = await s.kit.rpc<RunSubagent[]>({ method: "runs.subagents", runId: run.id });
    return list.length === 2 && list.some((a) => a.state === "running") ? list : undefined;
  });
  expect(running.map((a) => [a.type, a.state])).toEqual([
    ["Explore", "done"],
    ["ecc:code-reviewer", "running"],
  ]);
  const state = await s.kit.rpc<AgentsState>({ method: "getAgents" });
  expect(state.subagents?.map((a) => a.type)).toEqual(["ecc:code-reviewer"]);
  releaseFakeRun(join(s.kit.home, "fake", "projects"), run.sessionId);
  await runIn(s, run.id, ["done"]);
  const ended = await waitFor(async () => {
    const list = await s.kit.rpc<RunSubagent[]>({ method: "runs.subagents", runId: run.id });
    return list.every((a) => a.state === "done") ? list : undefined;
  });
  expect(ended.map((a) => a.result)).toEqual(["Trois fichiers concernés.", "RAS"]);
  const [explore] = ended;
  const own = await s.kit.rpc<RunMomentsPage>({
    method: "runs.subagentMoments",
    runId: run.id,
    subagentId: explore?.id,
  });
  expect(actions(own).map((a) => a.label)).toEqual([expect.stringContaining("git ls-files")]);
  const main = await s.kit.rpc<RunMomentsPage>({ method: "runMoments", runId: run.id });
  expect(actions(main).some((a) => a.label.includes("git ls-files"))).toBe(false);
  expect(main.moments.some((m) => m.data.kind === "reminder" && m.data.reminder === "overlap")).toBe(false);
}, 90_000);

test("verrous de la machine et import du registre full-delivery", async () => {
  const s = await emis();
  const heavy = join(SLOTS(s.kit.home), "heavy");
  mkdirSync(join(heavy, "held"), { recursive: true });
  writeFileSync(join(heavy, "max"), "2");
  const held = {
    pid: process.pid,
    since: 1,
    label: "emis:EMIS-15 gates",
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
    `{"projects":{"__proto__":${JSON.stringify(proto)},"emis":${JSON.stringify(entry)}}}`,
  );
  const imported = await s.kit.rpc<{ candidates: { name: string; matched: string | null }[] }>({
    method: "projects.importDelivery",
    registryPath: registry,
  });
  expect(imported.candidates.map((c) => [c.name, c.matched])).toEqual([["emis", s.project.id]]);
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
    name: "emis",
    registryPath: registry,
  });
  const meta = (await snapshot(s)).meta;
  expect(meta.worktree?.baseRef).toBe("origin/dev");
  expect(meta.delivery).not.toBeNull();
}, 60_000);

test("chaque méthode de DELIVERY_RPC est servie par une extension du démon", async () => {
  const s = await emis();
  const registryPath = join(s.kit.home, "absent.json");
  const requests: { [M in DeliveryRpcRequest["method"]]: Extract<DeliveryRpcRequest, { method: M }> } = {
    "agents.applyPreset": { method: "agents.applyPreset", ref: s.agent.ref, preset: "delivery" },
    deliver: { method: "deliver", projectId: s.project.id, ticketId: idOf(s, "EMIS-17") },
    setDeliveryStep: { method: "setDeliveryStep", projectId: s.project.id, ticketKey: "EMIS-1", step: 1 },
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
      name: "emis",
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
