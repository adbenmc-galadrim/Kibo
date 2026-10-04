import { listPages } from "@kibo/core";
import type { ChangeMessage, Phase7Event, RpcRequest } from "@kibo/schema";
import type { CommandHub } from "../command-path";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import type { RpcExtension, RpcHandler } from "../rpc-extensions";
import type { LocalSettings } from "../settings";
import { createDemoProject, isDemoProject, seedFromProject } from "./demo-project";
import { demoCommandGuard, demoRpcGuard } from "./local-guard";
import { demoNotesCleanup, prepareDemoNotes } from "./notes-cleanup";
import { tutorialRpc } from "./rpc";
import type { TutorialRun } from "./tutorial-eval";
import { createTutorialService, type TutorialService } from "./tutorial-service";
import { createTutorialSnapshot } from "./tutorial-snapshot";

export type TutorialBootDeps = {
  home: string;
  service: {
    handle(req: RpcRequest): unknown;
    onChange(listener: (message: ChangeMessage) => void): () => void;
    docs: Pick<Docs, "projectIds" | "project" | "workspace" | "emit">;
    commands: CommandHub;
  };
  settings: LocalSettings;
  projectSettings: ProjectSettings;
  notesDir(projectId: string): string;
  runs(): TutorialRun[];
  log(message: string, error?: unknown): void;
};

export type TutorialBoot = {
  tutorial: TutorialService;
  rpc: RpcExtension;
  guard: RpcHandler;
  prepareDelete(projectId: string): (() => void) | null;
  stop(): void;
};

const concernsDemo = (message: ChangeMessage, projectId: string | null): boolean =>
  ("type" in message && message.type === "run.changed") ||
  ("projectId" in message && projectId !== null && message.projectId === projectId);

export function startTutorial(deps: TutorialBootDeps): TutorialBoot {
  const { docs } = deps.service;
  const isDemo = (projectId: string) => isDemoProject(deps.projectSettings, projectId);
  const snapshot = createTutorialSnapshot({ docs, notesDir: deps.notesDir, runs: deps.runs });
  const findDemo = () => {
    const projectId = docs.projectIds().find(isDemo);
    const snap = projectId === undefined ? null : snapshot(projectId);
    if (projectId === undefined || snap === null) return null;
    const pages = listPages(docs.project(projectId));
    return { projectId, seed: seedFromProject({ ...snap, pages }, snap.noteHash) };
  };
  const tutorial = createTutorialService({
    settings: deps.settings,
    createDemo: async () => {
      const claimNotes = prepareDemoNotes(deps.home);
      const created = await createDemoProject({
        handle: async (req) => deps.service.handle(req),
        settings: deps.projectSettings,
      });
      claimNotes();
      return created;
    },
    findDemo,
    snapshot,
    emit: (event: Phase7Event) => docs.emit(event),
  });
  const offChange = deps.service.onChange((message) => {
    try {
      if (concernsDemo(message, tutorial.get().projectId)) tutorial.refresh();
    } catch (e) {
      deps.log("tutorial refresh failed", e);
    }
  });
  const offGuard = deps.service.commands.intercept(demoCommandGuard(isDemo));
  return {
    tutorial,
    rpc: tutorialRpc(tutorial),
    guard: demoRpcGuard(isDemo),
    prepareDelete: demoNotesCleanup({ home: deps.home, isDemo, notesDir: deps.notesDir, log: deps.log }),
    stop: () => {
      offChange();
      offGuard();
    },
  };
}
