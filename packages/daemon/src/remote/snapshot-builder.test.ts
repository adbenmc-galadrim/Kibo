import { afterEach, expect, test } from "bun:test";
import { basename } from "node:path";
import type { AgentSnapshot, ImageSnapshot, ProjectsIndex } from "@kibo/remote";
import type { ProjectAgentView, ProjectEvent, ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { questionImageFiles } from "../questions/question-images-port";
import {
  cleanLaunched,
  launchDaemon,
  looseRpc,
  seedSilo,
  type TypedRpc,
  withSeededImages,
} from "./remote.test-helper";
import { createSnapshotBuilder, type SnapshotBlock } from "./snapshot-builder";

afterEach(cleanLaunched);

const AGENT_DIR = "/Users/adam/.kibo/agents/project";

const decode = (block: SnapshotBlock | undefined): unknown =>
  JSON.parse(new TextDecoder().decode(block?.plaintext ?? new Uint8Array()));
const kinds = (blocks: SnapshotBlock[]) => blocks.map((b) => b.kind).sort();

async function setup(wrap: (rpc: TypedRpc) => TypedRpc = (rpc) => rpc) {
  const launched = await launchDaemon();
  const silo = await seedSilo(launched);
  const builder = createSnapshotBuilder({
    rpc: wrap(withSeededImages(silo)(launched.rpc)),
    readImage: questionImageFiles(launched.home, () => null).read,
  });
  return { launched, silo, builder };
}

test("buildAll(projectId) yields project, events, agent, ci, t3 and one image kind per image of an open question", async () => {
  const { silo, builder } = await setup();
  const { put, removed } = await builder.buildAll(silo.projectId);
  expect(removed).toEqual([]);
  expect(kinds(put)).toEqual(
    ["agent", "ci", "events", `image:${silo.openQuestion}:${silo.openImage}`, "project", "t3"].sort(),
  );
  expect(put.every((b) => b.projectId === silo.projectId)).toBe(true);
  const project = decode(put.find((b) => b.kind === "project")) as ProjectSnapshot;
  expect(project.meta.name).toBe("Silo");
  expect(project.questions.map((q) => q.id)).toContain(silo.openQuestion);
  const image = decode(put.find((b) => b.kind.startsWith("image:"))) as ImageSnapshot;
  expect(image).toEqual({ mime: "image/png", bytes: Buffer.from("png").toString("base64") });
});

test("the project block names the folder by its last segment only, never by its path", async () => {
  const { silo, builder } = await setup();
  const { put } = await builder.buildAll(silo.projectId);
  const project = decode(put.find((b) => b.kind === "project")) as ProjectSnapshot;
  expect(project.meta.folder).toBe(basename(silo.folder));
  expect(project.meta.folder).not.toContain("/");
});

test("the projects index lists only enabled projects with viewer, name, key, icon, pages", async () => {
  const { launched, silo, builder } = await setup();
  await seedSilo(launched, "Atelier", "ATL");
  const { put } = await builder.buildIndex([silo.projectId]);
  expect(put.map((b) => [b.projectId, b.kind])).toEqual([["_", "projects"]]);
  const index = decode(put[0]) as ProjectsIndex;
  expect(index.viewer).toBe("adam");
  expect(index.projects.map(({ id, name, key, icon }) => ({ id, name, key, icon }))).toEqual([
    { id: silo.projectId, name: "Silo", key: "SILO", icon: null },
  ]);
  const { pages } = await launched.rpc({ method: "getProject", projectId: silo.projectId });
  expect(index.projects[0]?.pages).toEqual(pages);
});

test("a second build without change yields no kind (content hash unchanged)", async () => {
  const { launched, silo, builder } = await setup();
  await builder.buildAll(silo.projectId);
  await builder.buildIndex([silo.projectId]);
  expect(await builder.buildAll(silo.projectId)).toMatchObject({ put: [], removed: [] });
  expect(await builder.buildIndex([silo.projectId])).toEqual({ put: [], removed: [], kinds: ["projects"] });
  await launched.rpc({
    method: "command",
    projectId: silo.projectId,
    command: { method: "createTicket", title: "Export des quotas" },
  });
  expect(kinds((await builder.buildAll(silo.projectId)).put)).toContain("project");
  builder.reset();
  expect((await builder.buildAll(silo.projectId)).put.length).toBe(6);
});

test("an image that leaves the open questions is reported as removed", async () => {
  const { launched, silo, builder } = await setup();
  await builder.buildAll(silo.projectId);
  await launched.rpc({
    method: "command",
    projectId: silo.projectId,
    command: { method: "archiveQuestion", questionId: silo.openQuestion, by: { kind: "human", ref: "adam" } },
  });
  expect((await builder.buildAll(silo.projectId)).removed).toEqual([
    `image:${silo.openQuestion}:${silo.openImage}`,
  ]);
});

test("events are the last 200", async () => {
  const requests: RpcRequest[] = [];
  const { silo, builder } = await setup((rpc) => (req) => {
    requests.push(req);
    return rpc(req);
  });
  const { put } = await builder.buildAll(silo.projectId);
  expect(requests.filter((r) => r.method === "listProjectEvents")).toEqual([
    { method: "listProjectEvents", projectId: silo.projectId, limit: 200 },
  ]);
  const events = decode(put.find((b) => b.kind === "events")) as ProjectEvent[];
  expect(events.map((e) => e.kind)).toContain("question_created");
});

test("agent logs include the current and past session runs", async () => {
  const session = (runId: string) => ({
    projectId: "p",
    runId,
    sessionId: `s-${runId}`,
    startedAt: 1,
    closedAt: null,
    lastTurnAt: null,
    title: null,
    messages: 1,
  });
  const view: ProjectAgentView = {
    session: session("run-now"),
    run: null,
    batches: [],
    past: [session("run-old")],
    memoryPath: "/Users/adam/.kibo/project-agent/silo/memory.md",
  };
  const { silo, builder } = await setup((rpc) =>
    looseRpc(async (req) => {
      if (req.method === "getProjectAgent") return view;
      if (req.method === "getRunLog")
        return [
          {
            id: 1,
            at: 1,
            event: {
              type: "spawned",
              pid: 7,
              resume: false,
              workspace: AGENT_DIR,
              cwd: AGENT_DIR,
              guidelines: 0,
              addDirs: [AGENT_DIR],
            },
          },
          { id: 2, at: 2, event: { type: "answered", text: `log ${req.runId}`, rank: 1 } },
        ];
      return rpc(req);
    }),
  );
  const { put } = await builder.buildAll(silo.projectId);
  const agent = decode(put.find((b) => b.kind === "agent")) as AgentSnapshot;
  expect(Object.keys(agent.logs).sort()).toEqual(["run-now", "run-old"]);
  expect(agent.logs["run-old"]?.map((entry) => entry.event)).toEqual([
    { type: "spawned", pid: 7, resume: false, workspace: "", guidelines: 0 },
    { type: "answered", text: "log run-old", rank: 1 },
  ]);
  expect(agent.view.memoryPath).toBe("");
  expect(JSON.stringify(agent).includes(AGENT_DIR)).toBe(false);
});

test("the agent block carries the batches of each past session, as the Mac shows them", async () => {
  const session = (runId: string) => ({
    projectId: "p",
    runId,
    sessionId: `s-${runId}`,
    startedAt: 1,
    closedAt: null,
    lastTurnAt: null,
    title: null,
    messages: 1,
  });
  const batch = (id: string, runId: string) => ({ id, runId, status: "applied" });
  const view = (runId?: string) => ({
    session: session(runId ?? "run-now"),
    run: runId ? { id: runId, workspace: AGENT_DIR, cwd: AGENT_DIR, transcriptPath: AGENT_DIR } : null,
    batches: [batch(`b-${runId ?? "run-now"}`, runId ?? "run-now")],
    past: [session("run-old"), session("run-older")],
    memoryPath: `${AGENT_DIR}/memory.md`,
  });
  const asked: (string | undefined)[] = [];
  const { silo, builder } = await setup((rpc) =>
    looseRpc(async (req) => {
      if (req.method === "getProjectAgent") {
        asked.push(req.runId);
        return view(req.runId);
      }
      if (req.method === "getRunLog") return [];
      return rpc(req);
    }),
  );
  const { put } = await builder.buildAll(silo.projectId);
  const agent = decode(put.find((b) => b.kind === "agent")) as AgentSnapshot;
  expect(asked.sort()).toEqual(["run-old", "run-older", undefined].sort());
  expect(agent.view.batches.map((b) => b.id)).toEqual(["b-run-now"]);
  expect(Object.keys(agent.pastBatches ?? {}).sort()).toEqual(["run-old", "run-older"]);
  expect(agent.pastBatches?.["run-old"]?.map((b) => b.id)).toEqual(["b-run-old"]);
  expect(JSON.stringify(agent).includes(AGENT_DIR)).toBe(false);
});

test("the current run of the agent leaves without its local paths", async () => {
  const run = {
    id: "run-now",
    label: "Agent de projet",
    workspace: AGENT_DIR,
    cwd: `${AGENT_DIR}/silo`,
    transcriptPath: `${AGENT_DIR}/transcript.jsonl`,
    tokens: 12,
  };
  const { silo, builder } = await setup((rpc) =>
    looseRpc(async (req) => {
      if (req.method === "getProjectAgent")
        return { session: null, run, batches: [], past: [], memoryPath: `${AGENT_DIR}/memory.md` };
      return rpc(req);
    }),
  );
  const { put } = await builder.buildAll(silo.projectId);
  const agent = decode(put.find((b) => b.kind === "agent")) as AgentSnapshot;
  expect(agent.view.run).toMatchObject({
    id: "run-now",
    tokens: 12,
    workspace: null,
    cwd: null,
    transcriptPath: null,
  });
  expect(JSON.stringify(agent).includes(AGENT_DIR)).toBe(false);
});

test("the t3 block keeps only available and reason, never the binary path", async () => {
  const { silo, builder } = await setup((rpc) =>
    looseRpc(async (req) => {
      if (req.method === "t3.status")
        return { available: false, reason: "server-down", bin: "/Users/adam/.local/bin/t3" };
      return rpc(req);
    }),
  );
  const { put } = await builder.buildAll(silo.projectId);
  expect(decode(put.find((b) => b.kind === "t3"))).toEqual({ available: false, reason: "server-down" });
});

test("no snapshot contains the pairing token, a keychain value or a folder path outside the project (the builder sends only what the screens show)", async () => {
  const { launched, silo, builder } = await setup();
  const view = await launched.rpc({ method: "getProjectAgent", projectId: silo.projectId });
  const blocks = [
    ...(await builder.buildAll(silo.projectId)).put,
    ...(await builder.buildIndex([silo.projectId])).put,
  ];
  const forbidden = [launched.daemon.token, view.memoryPath, launched.home, silo.folder];
  for (const block of blocks) {
    const text = new TextDecoder().decode(block.plaintext);
    for (const secret of forbidden) expect(text.includes(secret)).toBe(false);
  }
});
