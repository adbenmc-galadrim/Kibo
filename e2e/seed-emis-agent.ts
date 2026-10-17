import { EMIS_AGENT_PROMPT, EMIS_BATCH } from "./fixtures/emis-suivi";
import type { SeedRpc } from "./seed-emis-maquettes";

export type AgentWait = { timeoutMs: number; pollMs: number };

const DEFAULT_WAIT: AgentWait = { timeoutMs: 60_000, pollMs: 200 };
const ENDED = ["failed", "cancelled"];

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const hasBatch = (view: unknown): boolean =>
  listOf(field(view, "batches")).some(
    (b) => field(b, "seq") === EMIS_BATCH.seq && field(b, "status") === "pending",
  );

const agentView = (rpc: SeedRpc, projectId: string): Promise<unknown> =>
  rpc({ method: "getProjectAgent", projectId });

function turnOver(view: unknown, runId: unknown): boolean {
  const run = field(view, "run");
  if (field(run, "id") !== runId) return false;
  const state = field(run, "state");
  if (typeof state === "string" && ENDED.includes(state))
    throw new Error(`the project agent turn ended ${state}`);
  if (state !== "done") return false;
  if (hasBatch(view)) return true;
  throw new Error(`the project agent turn ended without batch ${EMIS_BATCH.seq}`);
}

export async function seedEmisAgent(
  rpc: SeedRpc,
  projectId: string,
  wait: AgentWait = DEFAULT_WAIT,
): Promise<boolean> {
  if (hasBatch(await agentView(rpc, projectId))) return false;
  const started = await rpc({ method: "sendProjectAgentMessage", projectId, text: EMIS_AGENT_PROMPT });
  const deadline = Date.now() + wait.timeoutMs;
  while (Date.now() < deadline) {
    if (turnOver(await agentView(rpc, projectId), field(started, "id"))) return true;
    await Bun.sleep(wait.pollMs);
  }
  throw new Error(`batch ${EMIS_BATCH.seq} was not proposed within ${wait.timeoutMs} ms`);
}
