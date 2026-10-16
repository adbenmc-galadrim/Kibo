import { EMIS_PROJECT } from "./fixtures/emis-maquettes";
import type { SeedRpc } from "./seed-emis-maquettes";

export type SyncSeed = { serverUrl: string; code: string; caFile: string };

const DEVICE = "MacBook d'Adam";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function emisId(rpc: SeedRpc): Promise<string> {
  const projects = await rpc({ method: "listProjects" });
  const emis = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === EMIS_PROJECT.key);
  const id = field(emis, "id");
  if (typeof id !== "string") throw new Error("Emis must be seeded before it is shared");
  return id;
}

export async function shareEmis(rpc: SeedRpc, sync: SyncSeed): Promise<void> {
  const status = await rpc({ method: "getSyncStatus" });
  if (field(status, "state") === "unconfigured")
    await rpc({ method: "connectSyncServer", ...sync, deviceName: DEVICE });
  const projectId = await emisId(rpc);
  const project = await rpc({ method: "getProject", projectId });
  if (field(field(project, "sync"), "shared") !== true) await rpc({ method: "shareProject", projectId });
}
