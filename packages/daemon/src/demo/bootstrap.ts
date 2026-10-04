import type { ChangeMessage, Phase7Event, RpcRequest } from "@kibo/schema";
import type { Docs } from "../docs";
import type { ProjectSettings } from "../notes/settings";
import type { RpcExtension } from "../rpc-extensions";
import type { LocalSettings } from "../settings";
import { createDemoProject } from "./demo-project";
import { tutorialRpc } from "./rpc";
import type { TutorialRun } from "./tutorial-eval";
import { createTutorialService, type TutorialService } from "./tutorial-service";
import { createTutorialSnapshot } from "./tutorial-snapshot";

export type TutorialBootDeps = {
  service: {
    handle(req: RpcRequest): unknown;
    onChange(listener: (message: ChangeMessage) => void): () => void;
    docs: Pick<Docs, "projectIds" | "project" | "workspace" | "emit">;
  };
  settings: LocalSettings;
  projectSettings: ProjectSettings;
  notesDir(projectId: string): string;
  runs(): TutorialRun[];
  log(message: string, error: unknown): void;
};

export type TutorialBoot = { tutorial: TutorialService; rpc: RpcExtension; stop(): void };

const concernsDemo = (message: ChangeMessage, projectId: string | null): boolean =>
  ("type" in message && message.type === "run.changed") ||
  ("projectId" in message && projectId !== null && message.projectId === projectId);

export function startTutorial(deps: TutorialBootDeps): TutorialBoot {
  const tutorial = createTutorialService({
    settings: deps.settings,
    createDemo: () =>
      createDemoProject({ handle: async (req) => deps.service.handle(req), settings: deps.projectSettings }),
    snapshot: createTutorialSnapshot({ docs: deps.service.docs, notesDir: deps.notesDir, runs: deps.runs }),
    emit: (event: Phase7Event) => deps.service.docs.emit(event),
  });
  const stop = deps.service.onChange((message) => {
    try {
      if (concernsDemo(message, tutorial.get().projectId)) tutorial.refresh();
    } catch (e) {
      deps.log("tutorial refresh failed", e);
    }
  });
  return { tutorial, rpc: tutorialRpc(tutorial), stop };
}
