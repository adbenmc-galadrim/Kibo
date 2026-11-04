import { expect, test } from "bun:test";
import { RpcRequest } from "@kibo/schema";
import { answerPhone } from "./phone-view";

const HOME = "/Users/adam";
const FOLDER = `${HOME}/Documents/silo`;
const AGENT_DIR = `${HOME}/.kibo/agents/project`;
const ABSOLUTE_PATH = /(^|[\s"'=:(])(\/(Users|home|private|var|tmp|opt|Volumes)\/|~\/)/;

const run = {
  id: "run-1",
  label: "Agent",
  workspace: AGENT_DIR,
  cwd: FOLDER,
  transcriptPath: `${AGENT_DIR}/t.jsonl`,
};
const view = { session: null, run, batches: [], past: [], memoryPath: `${AGENT_DIR}/memory.md` };
const log = [
  {
    id: 1,
    at: 1,
    event: {
      type: "spawned",
      pid: 7,
      resume: false,
      workspace: AGENT_DIR,
      cwd: FOLDER,
      guidelines: 0,
      addDirs: [FOLDER],
    },
  },
  {
    id: 2,
    at: 2,
    event: {
      type: "hook",
      payload: { event: "Stop", sessionId: "s", transcriptPath: `${AGENT_DIR}/t.jsonl` },
    },
  },
];
const status = { available: true, bin: `${HOME}/.local/bin/t3` };
const preview = {
  argv: [status.bin, "thread", "start", FOLDER, "/full-delivery SILO-45"],
  command: 't3 thread start ~/Documents/silo "/full-delivery SILO-45"',
  folder: "~/Documents/silo",
  warning: null,
};
const thread = {
  threadId: "th-1",
  link: "t3-thread://th-1",
  title: "SILO-45",
  status: "running",
  startedAt: 1,
  checkedAt: 1,
};

function macAnswer(req: RpcRequest): unknown {
  const kind = req.method === "componentCall" ? req.call.kind : req.method;
  switch (kind) {
    case "getProject":
      return { meta: { id: "p1", folder: FOLDER }, tickets: [] };
    case "getProjectAgent":
      return view;
    case "sendProjectAgentMessage":
      return run;
    case "getRunLog":
      return log;
    case "t3.status":
      return status;
    case "t3.preview":
      return preview;
    case "t3.launch":
      return { thread, command: preview.command };
    default:
      return null;
  }
}

const onTicket = { projectId: "p1", ticketKey: "SILO-45" };
const call = (kind: string, extra: Record<string, unknown> = {}): RpcRequest =>
  RpcRequest.parse({
    method: "componentCall",
    projectId: "p1",
    instanceId: "phone:kanban",
    call: { kind, ...extra },
  });
const RELAYED: RpcRequest[] = [
  { method: "getProject", projectId: "p1" },
  { method: "getProjectAgent", projectId: "p1" },
  { method: "sendProjectAgentMessage", projectId: "p1", text: "Point du jour ?" },
  { method: "getRunLog", runId: "run-1" },
  { method: "t3.status" },
  { method: "t3.preview", ...onTicket },
  { method: "t3.launch", ...onTicket },
  call("t3.status"),
  call("t3.preview", { ticketKey: "SILO-45" }),
  call("t3.launch", { ticketKey: "SILO-45" }),
];

test("no relayed response keeps a local path of the Mac, even where the Mac fills one in", async () => {
  for (const req of RELAYED) {
    const text = JSON.stringify(await answerPhone(req, async (asked) => macAnswer(asked)));
    expect({ method: req.method, text, leaks: ABSOLUTE_PATH.test(text) }).toMatchObject({ leaks: false });
    expect(text.includes(HOME)).toBe(false);
  }
});

test("the agent view keeps its run without workspace, cwd or transcript, and no memory path", async () => {
  const answer = await answerPhone({ method: "getProjectAgent", projectId: "p1" }, async () => view);
  expect(answer).toEqual({
    ...view,
    run: { ...run, workspace: null, cwd: null, transcriptPath: null },
    memoryPath: "",
  });
});

test("t3.status keeps only available and reason, the phone never uses the binary", async () => {
  expect(await answerPhone({ method: "t3.status" }, async () => status)).toEqual({ available: true });
  const down = { available: false, reason: "server-down", bin: status.bin };
  expect(await answerPhone(call("t3.status"), async () => down)).toEqual({
    available: false,
    reason: "server-down",
  });
});

test("the run log keeps its events without the folders of the spawn nor the transcript of a hook", async () => {
  const answer = await answerPhone({ method: "getRunLog", runId: "run-1" }, async () => log);
  expect(answer).toEqual([
    { id: 1, at: 1, event: { type: "spawned", pid: 7, resume: false, workspace: "", guidelines: 0 } },
    {
      id: 2,
      at: 2,
      event: { type: "hook", payload: { event: "Stop", sessionId: "s", transcriptPath: null } },
    },
  ]);
});
