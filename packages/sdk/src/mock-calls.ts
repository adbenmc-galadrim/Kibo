import { listQuestionRecipients, readProject } from "@kibo/core";
import {
  type CiRun,
  type ComponentCall,
  type ComponentManifest,
  type ComponentSettings,
  type EntityType,
  type FetchInit,
  type FetchResponse,
  KiboError,
  NO_ACTIVITY,
  type ProjectAsset,
  type ProjectCommand,
  type ProjectEvent,
  projectInfo,
  type StorybookOrigin,
  validateConfig,
} from "@kibo/schema";
import { mockAssetUrl } from "./mock-assets";
import { type MockFrame, mockDesignFrame } from "./mock-design";
import type { EntityMap } from "./types";

export type MockFetch = (url: string, init: FetchInit) => FetchResponse | Promise<FetchResponse>;
type MockCallDeps = {
  doc: Parameters<typeof readProject>[0];
  run(cmd: ProjectCommand): unknown;
  data: Map<string, unknown>;
  manifest: ComponentManifest;
  configPatches: Record<string, unknown>[];
  settings(): ComponentSettings;
  fetch?: MockFetch;
  ciRuns?: CiRun[];
  events?: ProjectEvent[];
  today: string;
  assets?: ProjectAsset[];
  frames?: MockFrame[];
  storybooks?: StorybookOrigin[];
};

function listEntity(deps: MockCallDeps, entity: EntityType): unknown[] {
  const snapshot = readProject(deps.doc, deps.today, NO_ACTIVITY);
  const lists: { [K in EntityType]: () => EntityMap[K][] } = {
    ticket: () => snapshot.tickets,
    status: () => snapshot.workflow,
    link: () => snapshot.links,
    page: () => snapshot.pages,
    ci_run: () => deps.ciRuns ?? [],
    question: () => snapshot.questions,
    sprint: () => snapshot.sprints,
    project_event: () => deps.events ?? [],
  };
  return lists[entity]();
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
      case "action":
        throw new KiboError("PERMISSION_DENIED", `unknown action ${c.name}`);
      case "settings.get":
        return deps.settings();
      case "project.get":
        return projectInfo(readProject(deps.doc, deps.today, NO_ACTIVITY), deps.today);
      case "assets.list":
        return deps.assets ?? [];
      case "assets.url":
        return mockAssetUrl(deps.assets ?? [], c.name);
      case "design.frame":
        return mockDesignFrame(deps.frames ?? [], c.url, c.refresh);
      case "design.storybooks":
        return deps.storybooks ?? [];
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
