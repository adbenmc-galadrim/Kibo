import {
  COMMAND_WRITES,
  type CommandResult,
  type ComponentManifest,
  type EntityType,
  KiboError,
  type ProjectCommand,
} from "@kibo/schema";
import type { EntityMap, KiboSdk, ProjectBackend, SdkContext } from "./types";

export function createSdk(backend: ProjectBackend, manifest: ComponentManifest, ctx: SdkContext): KiboSdk {
  return {
    ...ctx,
    async list<T extends EntityType>(type: T): Promise<EntityMap[T][]> {
      if (!manifest.reads.includes(type)) {
        throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare read ${type}`);
      }
      const loaders: { [K in EntityType]: () => Promise<EntityMap[K][]> } = {
        ticket: async () => (await backend.snapshot()).tickets,
        status: async () => (await backend.snapshot()).workflow,
        link: async () => (await backend.snapshot()).links,
        page: async () => (await backend.snapshot()).pages,
        run: () => backend.runs(),
        note: () => {
          throw new KiboError("PERMISSION_DENIED", "notes are served by componentCall");
        },
      };
      return loaders[type]();
    },
    async run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]> {
      const entity = COMMAND_WRITES[cmd.method];
      if (entity === null || !manifest.writes.includes(entity)) {
        throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare write ${cmd.method}`);
      }
      return (await backend.run(cmd)) as CommandResult[C["method"]];
    },
    subscribe: (listener, type) =>
      type === "run" ? backend.subscribeRuns(listener) : backend.subscribe(listener),
  };
}
