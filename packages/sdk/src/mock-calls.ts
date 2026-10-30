import { listQuestionRecipients, localSyncInfo, readProject } from "@kibo/core";
import {
  type CiRun,
  type ComponentCall,
  type ComponentManifest,
  type ComponentSettings,
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
  type ProjectEvent,
  projectInfo,
  type RunPeek,
  type StorybookOrigin,
  type TicketRun,
  validateConfig,
} from "@kibo/schema";
import { mockAssetUrl } from "./mock-assets";
import type { MockRunDelivery } from "./mock-delivery";
import { type MockFrame, mockDesignFrame } from "./mock-design";
import type { MockEmbeds } from "./mock-embed";
import { activityOf } from "./mock-runs";
import type { ServerContext, ServerDefinition } from "./server";
import type { EntityMap } from "./types";

export type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>;
export type MockCallDeps = {
  doc: Parameters<typeof readProject>[0];
  run(cmd: ProjectCommand): unknown;
  data: Map<string, unknown>;
  manifest: ComponentManifest;
  configPatches: Record<string, unknown>[];
  runs(): TicketRun[];
  peers(): PresencePeer[];
  access(): ProjectAccess;
  serverContext(): ServerContext;
  peek(runId: string): RunPeek;
  settings(): ComponentSettings;
  delivery: MockRunDelivery;
  fetch?: MockFetch;
  server?: ServerDefinition;
  mcp?: Record<string, McpCallResult>;
  ciRuns?: CiRun[];
  events?: ProjectEvent[];
  shared?: boolean;
  today: string;
  members?: MemberInfo[];
  assets?: ProjectAsset[];
  frames?: MockFrame[];
  storybooks?: StorybookOrigin[];
  embeds: MockEmbeds;
};

function listEntity(deps: MockCallDeps, entity: EntityType): unknown[] {
  const snapshot = readProject(deps.doc, deps.today, activityOf(deps.runs()));
  const lists: { [K in EntityType]: () => EntityMap[K][] } = {
    ticket: () => snapshot.tickets,
    status: () => snapshot.workflow,
    link: () => snapshot.links,
    page: () => snapshot.pages,
    run: () => deps.runs(),
    ci_run: () => deps.ciRuns ?? [],
    question: () => snapshot.questions,
    sprint: () => snapshot.sprints,
    project_event: () => deps.events ?? [],
  };
  return lists[entity]();
}

function mcpReply(deps: MockCallDeps, key: string): McpCallResult {
  const reply = deps.mcp?.[key];
  if (!reply) throw new KiboError("MCP_FAILED", `no programmed response for ${key}`);
  return reply;
}

export function createMockCalls(deps: MockCallDeps): (c: ComponentCall) => Promise<unknown> {
  const { data } = deps;
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
      case "settings.get":
        return deps.settings();
      case "project.get":
        return projectInfo(readProject(deps.doc, deps.today, activityOf(deps.runs())), deps.today);
      case "assets.list":
        return deps.assets ?? [];
      case "assets.url":
        return mockAssetUrl(deps.assets ?? [], c.name);
      case "design.frame":
        return mockDesignFrame(deps.frames ?? [], c.url, c.refresh);
      case "design.storybooks":
        return deps.storybooks ?? [];
      case "embed.open":
        return deps.embeds.open(c.url);
      case "run.peek":
        return deps.peek(c.runId);
      case "run.deliver":
        return deps.delivery.deliver(c.ticketId, c.mode);
      case "run.denials":
        return deps.delivery.denials(c.runId);
      case "run.deliveryAgent":
        return deps.delivery.agent();
      case "run.allowAndResume": {
        const { kind: _kind, ...input } = c;
        return deps.delivery.allowAndResume(input);
      }
      case "questions.recipients":
        return listQuestionRecipients(deps.doc);
      case "config.set": {
        const errors = validateConfig(deps.manifest.configSchema, c.patch);
        if (errors.length > 0) throw new KiboError("INVALID_INPUT", errors.join("; "));
        deps.configPatches.push(structuredClone(c.patch));
        return null;
      }
    }
  };
}
