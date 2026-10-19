import { SILO_HOLD_SINCE, SILO_HOLDS } from "./fixtures/silo-attente";
import { siloKey } from "./fixtures/silo-maquettes";
import { type SeedOptions, type SeedResult, type SeedRpc, seedSiloMaquettes } from "./seed-silo-maquettes";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

type HeldTicket = { id: string; held: boolean };

async function ticketsByKey(rpc: SeedRpc, projectId: string): Promise<Map<string, HeldTicket>> {
  const tickets = field(await rpc({ method: "getProject", projectId }), "tickets");
  if (!Array.isArray(tickets)) throw new Error("the Silo project has no ticket list");
  const byKey = new Map<string, HeldTicket>();
  for (const t of tickets) {
    const key = field(t, "key");
    const id = field(t, "id");
    if (typeof key === "string" && typeof id === "string")
      byKey.set(key, { id, held: field(field(t, "onHold"), "source") === "own" });
  }
  return byKey;
}

export async function seedSiloAttente(rpc: SeedRpc, options: SeedOptions): Promise<SeedResult> {
  const result = await seedSiloMaquettes(rpc, options);
  const tickets = await ticketsByKey(rpc, result.projectId);
  for (const h of SILO_HOLDS) {
    const ticket = tickets.get(siloKey(h.n));
    if (ticket === undefined) throw new Error(`${siloKey(h.n)} was not seeded`);
    if (ticket.held) continue;
    await rpc({
      method: "command",
      projectId: result.projectId,
      command: { method: "setHold", ticketId: ticket.id, reason: h.reason, since: SILO_HOLD_SINCE },
    });
  }
  return result;
}
