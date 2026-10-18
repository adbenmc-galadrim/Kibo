import { listInstances, listPages, listQuestions, listTickets } from "@kibo/core";
import { type ChangeMessage, KiboError, type Phase7Event } from "@kibo/schema";
import { declareTicketRef } from "../code/declare-ref";
import type { ProjectSettings } from "../notes/settings";
import type { RpcExtension, RpcHandler } from "../rpc-extensions";
import type { Service } from "../service";
import type { LocalSettings } from "../settings";
import { createDemoProject, isDemoProject, seedFromProject } from "./demo-project";
import { DEMO_REVIEW_PR, DEMO_ROLES, demoPrUrl } from "./demo-seed";
import { demoCommandGuard, demoRpcGuard } from "./local-guard";
import { demoNotesCleanup, prepareDemoNotes } from "./notes-cleanup";
import { tutorialRpc } from "./rpc";
import { createTutorialService, type TutorialService } from "./tutorial-service";
import { createTutorialSnapshot } from "./tutorial-snapshot";

export type TutorialBootDeps = {
  home: string;
  service: Service;
  settings: LocalSettings;
  projectSettings: ProjectSettings;
  notesDir(projectId: string): string;
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
  "projectId" in message && projectId !== null && message.projectId === projectId;

export function simulateDemoReview(
  service: Service,
  isDemo: (projectId: string) => boolean,
  projectId: string,
): void {
  if (!isDemo(projectId)) throw new KiboError("INVALID_INPUT", "only the demo project simulates a review");
  declareTicketRef(service, {
    projectId,
    ticketKey: DEMO_ROLES.review,
    ref: {
      kind: "github_pr",
      url: demoPrUrl(DEMO_REVIEW_PR.number),
      number: DEMO_REVIEW_PR.number,
      state: "open",
      base: DEMO_REVIEW_PR.base,
      head: DEMO_REVIEW_PR.head,
      review: "none",
      checks: null,
    },
  });
}

export function startTutorial(deps: TutorialBootDeps): TutorialBoot {
  const { docs } = deps.service;
  const isDemo = (projectId: string) => isDemoProject(deps.projectSettings, projectId);
  const snapshot = createTutorialSnapshot({ docs });
  const findDemo = () => {
    const projectId = docs.projectIds().find(isDemo);
    if (projectId === undefined) return null;
    const doc = docs.project(projectId);
    const project = {
      pages: listPages(doc),
      instances: listInstances(doc),
      tickets: listTickets(doc),
      questions: listQuestions(doc),
    };
    return { projectId, seed: seedFromProject(project) };
  };
  const tutorial = createTutorialService({
    settings: deps.settings,
    createDemo: async () => {
      const claimNotes = prepareDemoNotes(deps.home);
      const created = await createDemoProject({
        handle: async (req) => deps.service.handle(req),
        settings: deps.projectSettings,
        today: () => docs.today(),
      });
      claimNotes();
      return created;
    },
    findDemo,
    snapshot,
    emit: (event: Phase7Event) => docs.emit(event),
    simulateReview: (projectId) => simulateDemoReview(deps.service, isDemo, projectId),
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
