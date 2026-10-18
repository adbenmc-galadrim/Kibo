import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { fakeBuild, okReport } from "./components/service.test-helper";
import { startDaemon } from "./daemon";

const FIXED_NOW = "2026-10-16T14:52:00+02:00";
const Answer = z.object({ result: z.unknown(), error: z.object({ code: z.string() }).optional() });
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function launch() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tracking-start-"));
  const previous = process.env.KIBO_FIXED_NOW;
  process.env.KIBO_FIXED_NOW = FIXED_NOW;
  const started = startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    home,
  });
  const d = await started.finally(() => {
    if (previous === undefined) delete process.env.KIBO_FIXED_NOW;
    else process.env.KIBO_FIXED_NOW = previous;
  });
  cleanups.push(async () => {
    await d.stop();
    rmSync(home, { recursive: true, force: true });
  });
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: d.url },
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async (req: RpcRequest): Promise<unknown> => {
    const res = await fetch(`${d.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: d.url, cookie },
      body: JSON.stringify(req),
    });
    const answer = Answer.parse(await res.json());
    if (answer.error) return { refused: answer.error.code };
    return answer.result;
  };
}

test("a daemon started with KIBO_FIXED_NOW reports it and keeps agent execution hidden", async () => {
  const rpc = await launch();
  expect(await rpc({ method: "getAppInfo" })).toMatchObject({ fixedNow: FIXED_NOW });
  expect(await rpc({ method: "getAppSettings" })).toEqual({ agentExecution: "hidden" });
  expect(await rpc({ method: "setAppSettings", patch: { agentExecution: "shown" } })).toEqual({
    refused: "AGENT_EXECUTION_REMOVED",
  });
  expect(await rpc({ method: "getAppSettings" })).toEqual({ agentExecution: "hidden" });
});

test("a daemon built without the option refuses every ticket agent launch", async () => {
  const rpc = await launch();
  const Created = z.object({ id: z.string() });
  const project = Created.parse(
    await rpc({ method: "createProject", name: "Emis", key: "EMIS", folder: null, color: "#3b82f6" }),
  );
  const ticket = Created.parse(
    await rpc({ method: "command", projectId: project.id, command: { method: "createTicket", title: "Un" } }),
  );
  const target = { projectId: project.id, ticketId: ticket.id };
  const refused = { refused: "AGENT_EXECUTION_REMOVED" };
  expect(
    await rpc({ method: "assignAgent", ...target, profileId: "global:opus", brief: "", fresh: false }),
  ).toEqual(refused);
  expect(await rpc({ method: "deliver", ...target })).toEqual(refused);
  expect(await rpc({ method: "deliverAnswers", ...target })).toEqual(refused);
  const agents = z.object({ runs: z.array(z.unknown()) }).parse(await rpc({ method: "getAgents" }));
  expect(agents.runs).toEqual([]);
});
