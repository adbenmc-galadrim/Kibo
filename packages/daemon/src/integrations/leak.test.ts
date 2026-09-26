import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest, RpcResult } from "@kibo/schema";
import { z } from "zod";
import { type Daemon, startDaemon } from "../daemon";
import { ECHO_AUTH, type FakeGithub, LOGS_HOST, startFakeGithub } from "../testing/fake-github";
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
  rawFiles,
  sqliteDumps,
  until,
  type WsCollector,
} from "./leak.test-helper";

const SECRET = "ghp_TESTSECRET0123456789abcdefghijklmn";
const MCP_ENV = "mcp-env-secret-0123456789";
const MCP_BEARER = "mcp-bearer-secret-0123456789";
const SECRETS = [SECRET, MCP_ENV, MCP_BEARER];
const FIGMA_NODE = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";

type McpHttp = Awaited<ReturnType<typeof startFakeMcpHttp>>;
const Envelope = z.object({ ok: z.boolean(), result: z.unknown().optional() });

let gh: FakeGithub;
let mcpHttp: McpHttp;
let figmaMcp: McpHttp;
let output: CapturedOutput;
let home: string;
let repo: string;
let ciPoller: IntervalCapture;
let daemon: Daemon;
let events: WsCollector;
let stopped = false;
let cookie = "";
const responses: string[] = [];

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

beforeAll(async () => {
  gh = startFakeGithub({ token: SECRET });
  gh.addRepo("adam/kibo").pulls.set(12, { headSha: "abc123", headRef: "kib-1" });
  gh.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "kib-1",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [
      {
        id: 70,
        name: "build",
        status: "completed",
        conclusion: "failure",
        startedAt: null,
        completedAt: null,
        log: `##[error]boom\nAuthorization: Bearer ${SECRET}\n`,
      },
    ],
  });
  mcpHttp = await startFakeMcpHttp({ bearer: MCP_BEARER });
  figmaMcp = await startFakeMcpHttp();
  output = captureOutput();
  home = mkdtempSync(join(tmpdir(), "kibo-leak-"));
  repo = githubClone(mkdtempSync(join(tmpdir(), "kibo-leak-repo-")));
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
      "test-origins": `api.github.com=${gh.url},${LOGS_HOST}=${gh.url}`,
      "memory-secrets": true,
    }),
  });
  ciPoller.restore();
  const pair = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  cookie = (pair.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  events = await collectEvents(daemon.url, cookie);
});

afterAll(async () => {
  events.close();
  if (!stopped) await daemon.stop();
  output.restore();
  gh.stop();
  await mcpHttp.stop();
  await figmaMcp.stop();
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

async function githubScenario(): Promise<string> {
  await ok({ method: "connectGithub", auth: { mode: "token", token: SECRET } });
  const project = await ok({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: repo,
    color: "#71717A",
  });
  const binding = await ok({
    method: "createBinding",
    projectId: project.id,
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  });
  const run = (command: Extract<RpcRequest, { method: "command" }>["command"], instanceId?: string) =>
    ok({ method: "command", projectId: project.id, command, ...(instanceId && { instanceId }) });
  const page = z.object({ id: z.string() }).parse(await run({ method: "addPage", title: "K", kind: "view" }));
  const instance = z.object({ id: z.string() }).parse(
    await run({
      method: "addInstance",
      pageId: page.id,
      component: "kanban@1.0.0",
      config: { source: { bindingId: binding.id } },
    }),
  );
  gh.addIssue("adam/kibo", { title: "Depuis GitHub" });
  const sync = () => call({ method: "syncBinding", projectId: project.id, bindingId: binding.id });
  await sync();
  const created = z
    .object({ id: z.string() })
    .parse(await run({ method: "createTicket", title: "Depuis Kibo" }, instance.id));
  await sync();
  expect(gh.repos.get("adam/kibo")?.issues.size).toBe(2);

  await run({
    method: "upsertExternalRef",
    ticketId: created.id,
    ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
  });
  ciPoller.fire();
  const runs = () => ok({ method: "listCiRuns", projectId: project.id, ticketId: null });
  await until(async () => (await runs()).some((r) => r.jobs.length > 0), "the CI run and its jobs");
  const log = await ok({ method: "getCiLog", projectId: project.id, runId: 900, jobId: 70 });
  expect(log.text).toContain("Bearer ***");

  await ok({ method: "configureFigma", url: figmaMcp.url });
  await ok({ method: "linkFigmaNode", projectId: project.id, ticketId: created.id, url: FIGMA_NODE });
  await ok({ method: "getFigmaPreview", fileKey: "AbC123xyz", nodeId: "12:34" });

  gh.failNext("GET", /^\/repos\/adam\/kibo\/issues/, 500, ECHO_AUTH);
  await sync();
  await ok({ method: "getSyncState", projectId: project.id });
  gh.failNext("GET", /^\/user$/, 401, ECHO_AUTH);
  await call({ method: "testIntegration", id: "github" });
  return project.id;
}

async function mcpScenario(): Promise<void> {
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

test("after a full scenario, no secret appears anywhere", async () => {
  const projectId = await githubScenario();
  await mcpScenario();
  await ok({ method: "listIntegrations" });
  const snapshot = await ok({ method: "getProject", projectId });

  expect(responses.some((r) => r.includes("Bad credentials: Bearer ***"))).toBe(true);
  expect(JSON.stringify(snapshot)).toContain("Depuis Kibo");
  expect(events.messages.length).toBeGreaterThan(0);

  events.close();
  await daemon.stop();
  stopped = true;
  const leaks = leaksIn(
    [
      ["rpc responses", responses.join("\n")],
      ["console and std streams", output.lines().join("\n")],
      ["websocket events", events.messages.join("\n")],
      ["project snapshot", JSON.stringify(snapshot)],
      ...sqliteDumps(home),
      ...rawFiles(home),
    ],
    SECRETS,
  );
  expect(leaks).toEqual([]);
}, 60_000);
