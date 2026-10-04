import { localSyncInfo, readProject } from "@kibo/core";
import {
  type CiRun,
  type ComponentCall,
  type EntityType,
  type FetchInit,
  type FetchResponse,
  KiboError,
  type McpCallResult,
  type MemberInfo,
  type PresencePeer,
  type ProjectAccess,
  type ProjectAsset,
  type ProjectCommand,
  type TicketRun,
} from "@kibo/schema";
import { base64ToBytes, bytesToBase64 } from "./lib/base64";
import { mockAssetUrl } from "./mock-assets";
import type { MockNotesFolder } from "./mock-notes";
import type { ServerContext, ServerDefinition } from "./server";
import type { EntityMap } from "./types";

export type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>;
export type MockCallDeps = {
  doc: Parameters<typeof readProject>[0];
  run(cmd: ProjectCommand): unknown;
  data: Map<string, unknown>;
  folder: MockNotesFolder;
  runs(): TicketRun[];
  peers(): PresencePeer[];
  access(): ProjectAccess;
  serverContext(): ServerContext;
  fetch?: MockFetch;
  server?: ServerDefinition;
  mcp?: Record<string, McpCallResult>;
  ciRuns?: CiRun[];
  shared?: boolean;
  members?: MemberInfo[];
  assets?: ProjectAsset[];
};

function listEntity(deps: MockCallDeps, entity: EntityType): unknown[] {
  const snapshot = readProject(deps.doc);
  const lists: { [K in EntityType]: () => EntityMap[K][] } = {
    ticket: () => snapshot.tickets,
    status: () => snapshot.workflow,
    link: () => snapshot.links,
    page: () => snapshot.pages,
    run: () => deps.runs(),
    note: () => deps.folder.list(),
    ci_run: () => deps.ciRuns ?? [],
  };
  return lists[entity]();
}

function mcpReply(deps: MockCallDeps, key: string): McpCallResult {
  const reply = deps.mcp?.[key];
  if (!reply) throw new KiboError("MCP_FAILED", `no programmed response for ${key}`);
  return reply;
}

export function createMockCalls(deps: MockCallDeps): (c: ComponentCall) => Promise<unknown> {
  const { data, folder } = deps;
  return async (c) => {
    switch (c.kind) {
      case "list":
        return listEntity(deps, c.entity);
      case "run":
        return deps.run(c.command);
      case "data.get":
        return structuredClone(data.get(c.key));
      case "data.set":
        data.set(c.key, structuredClone(c.value));
        return null;
      case "data.delete":
        data.delete(c.key);
        return null;
      case "data.keys":
        return [...data.keys()];
      case "fetch":
        if (!deps.fetch) throw new KiboError("NOT_FOUND", `no response programmed for ${c.url}`);
        return deps.fetch(c.url, c.init);
      case "action": {
        const action = deps.server?.actions?.[c.name];
        if (!action) throw new KiboError("PERMISSION_DENIED", `unknown action ${c.name}`);
        return action(deps.serverContext(), c.input);
      }
      case "notes.read":
        return folder.read(c.path);
      case "notes.write":
        return folder.write(c.path, c.markdown, c.expectedMtime);
      case "notes.create":
        return folder.create(c.path, c.markdown);
      case "notes.rename":
        return folder.rename(c.from, c.to);
      case "notes.remove":
        folder.remove(c.path);
        return null;
      case "notes.search":
        return folder.search(c.query);
      case "notes.info":
        return folder.info();
      case "notes.attach":
        return { path: folder.attach(c.name, c.mime, base64ToBytes(c.bytes)) };
      case "notes.asset": {
        const asset = folder.asset(c.path);
        return { mime: asset.mime, bytes: bytesToBase64(asset.bytes) };
      }
      case "mcp.call":
        return mcpReply(deps, `${c.server}/${c.tool}`);
      case "mcp.read":
        return mcpReply(deps, `${c.server}@${c.uri}`);
      case "mcp.import":
        return deps.run({
          method: "importExternalTicket",
          title: c.item.title,
          ref: {
            kind: "mcp_item",
            server: c.server,
            itemId: c.item.itemId,
            url: c.item.url,
            title: c.item.title,
          },
        });
      case "presence.list":
        return deps.peers();
      case "sharing.get":
        return deps.shared
          ? {
              shared: true,
              keyAllocator: "server",
              role: "editor",
              access: deps.access(),
              members: deps.members ?? [],
            }
          : { ...localSyncInfo(deps.doc), access: deps.access() };
      case "assets.list":
        return deps.assets ?? [];
      case "assets.url":
        return mockAssetUrl(deps.assets ?? [], c.name);
    }
  };
}
