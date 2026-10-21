import { SILO_GRAPHE_FEATURE, SILO_GRAPHE_TITLE } from "./fixtures/silo-graphe";
import { field } from "./record-field";
import { seedSiloAttente } from "./seed-silo-attente";
import type { SeedOptions, SeedResult, SeedRpc } from "./seed-silo-maquettes";

type Feature = { id: string; title: unknown };

async function featureOf(rpc: SeedRpc, projectId: string, shortKey: string): Promise<Feature> {
  const tickets = field(await rpc({ method: "getProject", projectId }), "tickets");
  const found = Array.isArray(tickets) ? tickets.find((t) => field(t, "shortKey") === shortKey) : undefined;
  const id = field(found, "id");
  if (typeof id !== "string") throw new Error(`${shortKey} was not seeded`);
  return { id, title: field(found, "title") };
}

export async function seedSiloGraphe(rpc: SeedRpc, options: SeedOptions): Promise<SeedResult> {
  const result = await seedSiloAttente(rpc, options);
  const feature = await featureOf(rpc, result.projectId, SILO_GRAPHE_FEATURE);
  if (feature.title !== SILO_GRAPHE_TITLE)
    await rpc({
      method: "command",
      projectId: result.projectId,
      command: { method: "updateTicket", ticketId: feature.id, title: SILO_GRAPHE_TITLE },
    });
  return result;
}
