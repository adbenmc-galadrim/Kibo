import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest, RpcResult } from "@kibo/schema";
import { z } from "zod";
import { type Daemon, startDaemon } from "../daemon";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST } from "../testing/fake-github";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "../testing/fake-mcp";
import { parseIntegrationFlags } from "./bootstrap";
import {
  type CapturedOutput,
  captureIntervalsFrom,
  captureOutput,
  collectEvents,
  githubClone,
  type IntervalCapture,
  leaksIn,
  type Place,
  rawFiles,
  seedGithub,
  sqliteDumps,
  until,
  type WsCollector,
} from "./leak.test-helper";
import {
  type DesignFakes,
  designScenario,
  FIGMA_NODE,
  FIGMA_TOKEN,
  PENPOT_TOKEN,
  startDesignFakes,
} from "./leak-design.test-helper";

const SECRET = "ghp_TESTSECRET0123456789abcdefghijklmn";
const MCP_ENV = "mcp-env-secret-0123456789";
const MCP_BEARER = "mcp-bearer-secret-0123456789";
const SECRETS = [SECRET, MCP_ENV, MCP_BEARER, FIGMA_TOKEN, PENPOT_TOKEN];
const FOREIGN_ECHO = JSON.stringify({ message: `upstream said ${MCP_ENV}` });

type McpHttp = Awaited<ReturnType<typeof startFakeMcpHttp>>;
type Command = Extract<RpcRequest, { method: "command" }>["command"];
const Envelope = z.object({ ok: z.boolean(), result: z.unknown().optional() });
const Created = z.object({ id: z.string() });
const McpText = z.object({ content: z.array(z.object({ type: z.literal("text"), text: z.string() })) });

let gh: FakeGithub;
let mcpHttp: McpHttp;
let figmaMcp: McpHttp;
let design: DesignFakes;
let output: CapturedOutput;
let repo: string;
let home: string;
let ciPoller: IntervalCapture;
let daemon: Daemon;
let events: WsCollector;
let stopped = false;
let cookie = "";
const responses: string[] = [];
const cleanups: (() => void | Promise<void>)[] = [];

async function call(req: RpcRequest): Promise<z.infer<typeof Envelope> & { text: string }> {
  const res = await fetch(`${daemon.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url, cookie },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  responses.push(text);
  return { ...Envelope.parse(JSON.parse(text)), text };
}

async function ok<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]> {
  const body = await call(req);
  if (!body.ok) throw new Error(`${req.method} failed: ${body.text}`);
  return body.result as RpcResult[R["method"]];
}

const run = (projectId: string, command: Command, instanceId?: string) =>
  ok({ method: "command", projectId, command, ...(instanceId && { instanceId }) });

beforeAll(async () => {
  gh = seedGithub(SECRET);
  cleanups.push(() => gh.stop());
  mcpHttp = await startFakeMcpHttp({ bearer: MCP_BEARER });
  cleanups.push(() => mcpHttp.stop());
  figmaMcp = await startFakeMcpHttp();
  cleanups.push(() => figmaMcp.stop());
  design = startDesignFakes();
  cleanups.push(() => design.stop());
  output = captureOutput();
  cleanups.push(() => output.restore());
  home = mkdtempSync(join(tmpdir(), "kibo-leak-"));
  repo = githubClone(mkdtempSync(join(tmpdir(), "kibo-leak-repo-")));
  cleanups.push(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  });
  ciPoller = captureIntervalsFrom(join("ci", "poller.ts"));
  daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    redactor: output.redactor,
    integrations: parseIntegrationFlags({
      "test-origins": `api.github.com=${gh.url},${LOGS_HOST}=${gh.url},${design.origins}`,
      "memory-secrets": true,
    }),
  }).finally(() => ciPoller.restore());
  cleanups.push(() => (stopped ? undefined : daemon.stop()));
  const pair = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  cookie = (pair.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  events = await collectEvents(daemon.url, cookie);
  cleanups.push(() => events.close());
});

afterAll(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function addMcpServers(): Promise<void> {
  const stdio = {
    transport: "stdio" as const,
    id: "fake",
    name: "Fake",
    command: process.execPath,
    args: [FAKE_MCP_STDIO],
    envNames: ["FAKE_TOKEN"],
  };
  const line = await ok({ method: "previewMcpServer", server: stdio });
  await ok({
    method: "addMcpServer",
    server: stdio,
    confirmedCommandLine: line.commandLine,
    secrets: { FAKE_TOKEN: MCP_ENV },
  });
  expect((await ok({ method: "testMcpServer", id: "fake" })).state).toBe("connected");
  const http = { transport: "http" as const, id: "remote", name: "Remote", url: mcpHttp.url, bearer: true };
  await ok({
    method: "addMcpServer",
    server: http,
    confirmedCommandLine: mcpHttp.url,
    secrets: { bearer: MCP_BEARER },
  });
  expect((await ok({ method: "testMcpServer", id: "remote" })).state).toBe("connected");
  await ok({ method: "listMcpServers" });
}

async function syncedKanban(projectId: string) {
  const binding = await ok({
    method: "createBinding",
    projectId,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
  const page = Created.parse(await run(projectId, { method: "addPage", title: "K", kind: "view" }));
  const instance = Created.parse(
    await run(projectId, {
      method: "addInstance",
      pageId: page.id,
      component: "kanban@1.0.0",
      config: { source: { bindingId: binding.id } },
    }),
  );
  const sync = () => call({ method: "syncBinding", projectId, bindingId: binding.id });
  return { instanceId: instance.id, sync };
}

async function githubScenario(): Promise<{ projectId: string; ticketId: string }> {
  await ok({ method: "connectGithub", auth: { mode: "token", token: SECRET } });
  const project = await ok({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: repo,
    color: "#71717A",
  });
  const kanban = await syncedKanban(project.id);
  gh.addIssue("adam/kibo", { title: "Depuis GitHub" });
  gh.addIssue("adam/kibo", { title: `Echo ${SECRET}` });
  await kanban.sync();
  const created = Created.parse(
    await run(project.id, { method: "createTicket", title: "Depuis Kibo" }, kanban.instanceId),
  );
  await kanban.sync();
  expect(gh.repos.get("adam/kibo")?.issues.size).toBe(3);

  await run(project.id, {
    method: "upsertExternalRef",
    ticketId: created.id,
    ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
  });
  ciPoller.fire();
  const runs = () => ok({ method: "listCiRuns", projectId: project.id, ticketId: null });
  await until(async () => (await runs()).some((r) => r.jobs.length > 0), "the CI run and its jobs");
  const log = await ok({ method: "getCiLog", projectId: project.id, runId: 900, jobId: 70 });
  expect(log.text).toContain("Bearer ***");

  await ok({ method: "connectFigma", auth: { mode: "mcp", url: figmaMcp.url } });
  await ok({ method: "linkDesignFrame", projectId: project.id, ticketId: created.id, url: FIGMA_NODE });
  await ok({ method: "getDesignFrame", url: FIGMA_NODE, refresh: false });

  gh.failNext("GET", /^\/repos\/adam\/kibo\/issues/, 500, ECHO_AUTH);
  await kanban.sync();
  gh.failNext("GET", /^\/repos\/adam\/kibo\/issues/, 422, FOREIGN_ECHO);
  await kanban.sync();
  const state = JSON.stringify(await ok({ method: "getSyncState", projectId: project.id }));
  expect(state).toContain("upstream said ***");
  gh.failNext("GET", /^\/user$/, 401, ECHO_AUTH);
  await call({ method: "testIntegration", id: "github" });
  gh.failNext("GET", /^\/user$/, 401, FOREIGN_ECHO);
  expect(JSON.stringify(await ok({ method: "testIntegration", id: "github" }))).toContain(
    "upstream said ***",
  );
  return { projectId: project.id, ticketId: created.id };
}

async function mcpSourceScenario(projectId: string): Promise<void> {
  const page = Created.parse(await run(projectId, { method: "addPage", title: "M", kind: "view" }));
  const instance = Created.parse(
    await run(projectId, {
      method: "addInstance",
      pageId: page.id,
      component: "mcp-source@1.0.0",
      config: { server: "fake", mode: "tool", tool: "env", args: "{}", itemsPointer: "/items" },
    }),
  );
  const mcpCall = (tool: string) =>
    ok({
      method: "componentCall",
      projectId,
      instanceId: instance.id,
      call: { kind: "mcp.call", server: "fake", tool, args: {} },
    });
  expect(McpText.parse(await mcpCall("env")).content[0]?.text).toContain('"hasToken":true');
  expect(McpText.parse(await mcpCall("echo_env")).content[0]?.text).toBe("invalid token ***");
  await mcpCall("log_env");
  await until(async () => output.lines().some((l) => l.includes("token ***")), "the relayed stderr line");
}

function journalsWereWritten(tables: Place[]): void {
  const live = (where: string) => !where.includes(`${sep}backups${sep}`);
  const table = (name: string) =>
    tables.find(([where]) => where.startsWith(`table ${name} in `) && live(where))?.[1] ?? "";
  expect(table("mcp_calls")).toContain('"tool":"echo_env"');
  expect(table("mcp_calls")).toContain('"tool":"get_screenshot"');
  expect(table("integration_events")).toContain("upstream said ***");
  expect(table("component_events")).not.toBe("");
  expect(tables.some(([where]) => where.startsWith("loro doc "))).toBe(true);
}

test("after a full scenario, no secret appears anywhere", async () => {
  await addMcpServers();
  const { projectId, ticketId } = await githubScenario();
  await mcpSourceScenario(projectId);
  await designScenario(design, { ok, call }, projectId, ticketId);
  await ok({ method: "listIntegrations" });
  const snapshot = await ok({ method: "getProject", projectId });

  expect(responses.some((r) => r.includes("Bad credentials: Bearer ***"))).toBe(true);
  expect(JSON.stringify(snapshot)).toContain("Depuis Kibo");
  expect(JSON.stringify(snapshot)).toContain("Echo ***");
  expect(events.messages.length).toBeGreaterThan(0);

  const whileRunning = rawFiles(home).map(([where, content]): Place => [`${where} (running)`, content]);
  events.close();
  await daemon.stop();
  stopped = true;
  const tables = sqliteDumps(home);
  journalsWereWritten(tables);
  const leaks = leaksIn(
    [
      ["rpc responses", responses.join("\n")],
      ["console and std streams", output.lines().join("\n")],
      ["websocket events", events.messages.join("\n")],
      ["project snapshot", JSON.stringify(snapshot)],
      ...tables,
      ...whileRunning,
      ...rawFiles(home),
      ...rawFiles(repo),
    ],
    SECRETS,
  );
  expect(leaks).toEqual([]);
}, 60_000);
