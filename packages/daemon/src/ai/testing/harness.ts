import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  ChangeMessage,
  ComponentDraftDetails,
  DraftStatus,
  RpcRequest,
  RpcResult,
  ValidationReport,
} from "@kibo/schema";
import { z } from "zod";
import { aiScenarioPath } from "../../agents/fake-claude-ai";
import { FAKE_CLAUDE } from "../../agents/fake-claude-scenario";
import { startDaemon } from "../../daemon";

export type AiHarness = {
  home: string;
  fakeState: string;
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  events: ChangeMessage[];
  waitFor(pred: (e: ChangeMessage) => boolean, ms?: number): Promise<ChangeMessage>;
  waitDraft(draftId: string, status: DraftStatus, ms?: number): Promise<ComponentDraftDetails>;
  stop(): Promise<void>;
};

export type AiHarnessOptions = {
  scenario: string;
  claudeBin?: string;
  assistantTimeoutMs?: number;
  validate?: (dir: string, signal: AbortSignal) => Promise<ValidationReport>;
};

const Envelope = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);

async function pair(url: string, token: string): Promise<string> {
  const res = await fetch(`${url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url },
    body: JSON.stringify({ token }),
  });
  if (res.status !== 204) throw new Error(`pairing failed: ${res.status}`);
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function listen(url: string, cookie: string, events: ChangeMessage[], waiters: Set<() => void>) {
  const ws = new WebSocket(`${url.replace("http", "ws")}/api/events`, { headers: { cookie, origin: url } });
  ws.onmessage = (m) => {
    events.push(JSON.parse(String(m.data)));
    for (const w of [...waiters]) w();
  };
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("event socket failed"));
  });
  return ws;
}

export async function startAiHarness(opts: AiHarnessOptions): Promise<AiHarness> {
  const home = mkdtempSync(join(tmpdir(), "kibo-ai-"));
  const fakeState = join(home, "fake");
  mkdirSync(fakeState);
  const daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: opts.claudeBin ?? FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    ...(opts.validate && { validate: opts.validate }),
    agentEnv: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      KIBO_FAKE_CLAUDE_SCENARIO: aiScenarioPath(opts.scenario),
      KIBO_FAKE_CLAUDE_STATE: fakeState,
    },
    assistantTimeoutMs: opts.assistantTimeoutMs ?? 1_000,
  });
  const cookie = await pair(daemon.url, daemon.token);
  const events: ChangeMessage[] = [];
  const waiters = new Set<() => void>();
  const ws = await listen(daemon.url, cookie, events, waiters);
  const post = async (req: RpcRequest): Promise<unknown> => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: daemon.url, cookie },
      body: JSON.stringify(req),
    });
    const body = Envelope.parse(await res.json());
    if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
    return body.result;
  };
  const rpc = <R extends RpcRequest>(req: R) => post(req) as Promise<RpcResult[R["method"]]>;
  const waitFor = (pred: (e: ChangeMessage) => boolean, ms = 10_000) =>
    new Promise<ChangeMessage>((resolve, reject) => {
      const check = () => {
        const hit = events.find(pred);
        if (!hit) return;
        waiters.delete(check);
        clearTimeout(timer);
        resolve(hit);
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error("timeout waiting for a daemon event"));
      }, ms);
      waiters.add(check);
      check();
    });
  return {
    home,
    fakeState,
    rpc,
    events,
    waitFor,
    async waitDraft(draftId, status, ms = 120_000) {
      const deadline = Date.now() + ms;
      for (;;) {
        const d = await rpc({ method: "getComponentDraft", draftId });
        if (d.status === status) return d;
        if (Date.now() > deadline) throw new Error(`draft ${draftId} is ${d.status}, expected ${status}`);
        await Bun.sleep(100);
      }
    },
    async stop() {
      ws.close();
      await daemon.stop();
      rmSync(home, { recursive: true, force: true });
    },
  };
}
