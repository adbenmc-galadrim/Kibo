import {
  type CommandResult,
  type ComponentManifest,
  type EntityType,
  KiboError,
  type ProjectCommand,
} from "@kibo/schema";
import type { EntityMap, KiboSdk, ProjectBackend, SdkContext } from "./types";

const WRITES: Record<ProjectCommand["method"], EntityType | null> = {
  addPage: "page",
  renamePage: "page",
  movePage: "page",
  deletePage: "page",
  createTicket: "ticket",
  updateTicket: "ticket",
  setStatus: "ticket",
  moveTicket: "ticket",
  deleteTicket: "ticket",
  addLink: "link",
  removeLink: "link",
  addInstance: null,
  removeInstance: null,
};

export function createSdk(backend: ProjectBackend, manifest: ComponentManifest, ctx: SdkContext): KiboSdk {
  return {
    ...ctx,
    async list<T extends EntityType>(type: T): Promise<EntityMap[T][]> {
      if (!manifest.reads.includes(type)) {
        throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare read ${type}`);
      }
      const s = await backend.snapshot();
      const lists: { [K in EntityType]: EntityMap[K][] } = {
        ticket: s.tickets,
        status: s.workflow,
        link: s.links,
        page: s.pages,
      };
      return lists[type];
    },
    async run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]> {
      const entity = WRITES[cmd.method];
      if (entity === null || !manifest.writes.includes(entity)) {
        throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare write ${cmd.method}`);
      }
      return (await backend.run(cmd)) as CommandResult[C["method"]];
    },
    subscribe: backend.subscribe,
  };
}
