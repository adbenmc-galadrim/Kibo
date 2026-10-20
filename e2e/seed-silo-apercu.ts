import { externalRefKey } from "../packages/schema/src/index";
import { SILO_APERCU_FRAME, SILO_APERCU_TICKET } from "./fixtures/silo-apercu";
import { siloKey } from "./fixtures/silo-maquettes";
import { field } from "./record-field";
import { type SeedOptions, type SeedResult, type SeedRpc, seedSiloMaquettes } from "./seed-silo-maquettes";
import { ticketsByKey } from "./seed-silo-prs";
import { E2E_FIGMA_TOKEN } from "./token";

const FRAME_KEY = `${SILO_APERCU_FRAME.fileKey}:${SILO_APERCU_FRAME.nodeId}`;

async function figmaConnected(rpc: SeedRpc): Promise<boolean> {
  const listed = await rpc({ method: "listIntegrations" });
  const statuses: unknown[] = Array.isArray(listed) ? listed : [];
  return statuses.some((s) => field(s, "id") === "figma" && field(s, "state") === "connected");
}

export async function seedSiloApercu(rpc: SeedRpc, options: SeedOptions): Promise<SeedResult> {
  const result = await seedSiloMaquettes(rpc, options);
  const { projectId } = result;
  const ticket = (await ticketsByKey(rpc, projectId)).get(siloKey(SILO_APERCU_TICKET));
  if (ticket === undefined) throw new Error(`${siloKey(SILO_APERCU_TICKET)} was not seeded`);
  if (!(await figmaConnected(rpc)))
    await rpc({ method: "connectFigma", auth: { mode: "token", token: E2E_FIGMA_TOKEN } });
  const linked = ticket.refs.some((r) => r.kind === "figma_node" && externalRefKey(r) === FRAME_KEY);
  if (!linked)
    await rpc({ method: "linkDesignFrame", projectId, ticketId: ticket.id, url: SILO_APERCU_FRAME.url });
  return result;
}
