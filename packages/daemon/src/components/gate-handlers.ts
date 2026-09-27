import { localSyncInfo, readInstanceData, readProject, writeInstanceData } from "@kibo/core";
import { KiboError, type PresencePeer, type ProjectSyncInfo, type TicketRun } from "@kibo/schema";
import type { Docs } from "../docs";
import type { ComponentIntegrationHooks } from "../integrations/types";
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
  integrations?: () => ComponentIntegrationHooks | null;
  presence?: (projectId: string) => PresencePeer[];
  sharing?: (projectId: string) => ProjectSyncInfo;
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
      if (entity === "ci_run") {
        const ciRuns = deps.integrations?.()?.ciRuns ?? null;
        if (!ciRuns) throw new KiboError("NOT_CONNECTED", "ci not started");
        return ciRuns(projectId);
      }
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
      docs.assertWritable(projectId);
      writeInstanceData(docs.project(projectId), instanceId, call.key, value);
      changed(projectId);
      return null;
    },
    fetch: (grant, url, init) => {
      const hooks = deps.integrations?.() ?? null;
      return proxyFetch(grant?.net ?? null, url, init, {
        ...deps.net,
        ...(hooks && { hooks }),
        ...(grant && { secrets: grant.secrets }),
      });
    },
    action: (ref, projectId, instanceId, config, name, input) =>
      deps.backends().action(ref, { projectId, instanceId, config, name, input }),
    notes: (projectId, call) => deps.notes.handle(projectId, call),
    async mcp(projectId, instanceId, call) {
      const gate = deps.integrations?.()?.mcp ?? null;
      if (!gate) throw new KiboError("MCP_UNAVAILABLE", "mcp hub not started");
      const ctx = { projectId, instanceId };
      if (call.kind === "mcp.call") return gate.call(ctx, call.server, call.tool, call.args);
      if (call.kind === "mcp.read") return gate.read(ctx, call.server, call.uri);
      return gate.importItem(ctx, call.server, call.item);
    },
    presence: async (projectId) => deps.presence?.(projectId) ?? [],
    sharing: async (projectId) => deps.sharing?.(projectId) ?? localSyncInfo(docs.project(projectId)),
  };
}
