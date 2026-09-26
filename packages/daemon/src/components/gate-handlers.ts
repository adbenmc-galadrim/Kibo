import { readInstanceData, readProject, writeInstanceData } from "@kibo/core";
import type { TicketRun } from "@kibo/schema";
import type { Docs } from "../docs";
import type { NotesService } from "../notes/service";
import type { Backends } from "./backends";
import type { DataCall, GateHandlers } from "./gate";
import { type NetProxyOptions, proxyFetch } from "./net-proxy";

export type GateHandlersDeps = {
  docs: Docs;
  notes: NotesService;
  backends: () => Backends;
  runs(projectId: string): TicketRun[];
  net?: NetProxyOptions;
};

function readData(docs: Docs, projectId: string, instanceId: string, call: DataCall): unknown {
  const data = readInstanceData(docs.project(projectId), instanceId);
  return call.kind === "data.get" ? (data[call.key] ?? null) : Object.keys(data);
}

export function createGateHandlers(deps: GateHandlersDeps): GateHandlers {
  const { docs } = deps;
  const changed = (projectId: string) => {
    docs.save(projectId);
    docs.emit({ projectId });
  };
  return {
    async list(projectId, entity) {
      if (entity === "run") return deps.runs(projectId);
      const snap = readProject(docs.project(projectId));
      const lists = { ticket: snap.tickets, status: snap.workflow, link: snap.links, page: snap.pages };
      return lists[entity];
    },
    run: async (projectId, instanceId, command) =>
      docs.run(projectId, command, { origin: "user", instanceId }),
    async data(projectId, instanceId, call) {
      if (call.kind === "data.get" || call.kind === "data.keys")
        return readData(docs, projectId, instanceId, call);
      const value = call.kind === "data.set" ? call.value : null;
      writeInstanceData(docs.project(projectId), instanceId, call.key, value);
      changed(projectId);
      return null;
    },
    fetch: (rules, url, init) => proxyFetch(rules, url, init, deps.net),
    action: (ref, projectId, instanceId, config, name, input) =>
      deps.backends().action(ref, { projectId, instanceId, config, name, input }),
    notes: (projectId, call) => deps.notes.handle(projectId, call),
  };
}
