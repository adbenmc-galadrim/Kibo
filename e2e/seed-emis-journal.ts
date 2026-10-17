import { EMIS_LAST_FACTS, type FactSpec } from "./fixtures/emis-suivi";
import type { SeedRpc } from "./seed-emis-maquettes";

export type JournalWait = { timeoutMs: number; pollMs: number };

const DEFAULT_WAIT: JournalWait = { timeoutMs: 30_000, pollMs: 100 };
const SCANNED = 50;

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const lastEvents = async (rpc: SeedRpc, projectId: string, limit: number): Promise<unknown[]> =>
  listOf(field(await rpc({ method: "listProjectEvents", projectId, limit }), "items"));

const isMergeOf = (number: number) => (event: unknown) =>
  field(event, "kind") === "pr_merged" && field(field(event, "data"), "number") === number;

export async function waitForMerge(
  rpc: SeedRpc,
  projectId: string,
  number: number,
  wait: JournalWait = DEFAULT_WAIT,
): Promise<void> {
  const deadline = Date.now() + wait.timeoutMs;
  while (Date.now() < deadline) {
    if ((await lastEvents(rpc, projectId, SCANNED)).some(isMergeOf(number))) return;
    await Bun.sleep(wait.pollMs);
  }
  throw new Error(
    `the PR poller did not merge #${number} within ${wait.timeoutMs} ms (is KIBO_PR_POLL_MS set?)`,
  );
}

async function keysById(rpc: SeedRpc, projectId: string): Promise<Map<unknown, unknown>> {
  const tickets = listOf(field(await rpc({ method: "getProject", projectId }), "tickets"));
  return new Map(tickets.map((t) => [field(t, "id"), field(t, "key")]));
}

const describeFact = (f: FactSpec): string => `${f.kind} ${f.key ?? "-"} ${JSON.stringify(f.data)}`;

function matches(spec: FactSpec, event: unknown, keys: ReadonlyMap<unknown, unknown>): boolean {
  const ticketId = field(event, "ticketId");
  const key = ticketId === null ? null : keys.get(ticketId);
  const data = field(event, "data");
  return (
    field(event, "kind") === spec.kind &&
    key === spec.key &&
    Object.entries(spec.data).every(([k, v]) => field(data, k) === v)
  );
}

export async function verifyEmisJournal(rpc: SeedRpc, projectId: string): Promise<void> {
  const newestFirst = await lastEvents(rpc, projectId, EMIS_LAST_FACTS.length);
  const events = [...newestFirst].reverse();
  const keys = await keysById(rpc, projectId);
  if (EMIS_LAST_FACTS.every((spec, i) => matches(spec, events[i], keys))) return;
  const found = events.map((e) => JSON.stringify(e)).join(" ; ");
  throw new Error(
    `the journal ends with ${found}, expected ${EMIS_LAST_FACTS.map(describeFact).join(" ; ")}`,
  );
}
