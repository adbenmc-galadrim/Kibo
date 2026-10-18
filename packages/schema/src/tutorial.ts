import { z } from "zod";

export const TUTORIAL_STEPS = ["overview", "feature", "review", "question", "copy"] as const;
export const TutorialStep = z.enum(TUTORIAL_STEPS);
export type TutorialStep = z.infer<typeof TutorialStep>;
export const TutorialStatus = z.enum(["never", "active", "paused", "skipped", "done", "closed"]);
export type TutorialStatus = z.infer<typeof TutorialStatus>;

export const TutorialView = z.enum(["overview", "copy"]);
export type TutorialView = z.infer<typeof TutorialView>;

const Id = z.string().min(1);
export const TutorialSeed = z.object({
  featureIds: z.array(Id),
  reviewTicketId: Id,
  questionId: Id,
  copyTicketId: Id,
  overviewPageId: Id,
  planningPageId: Id,
  kanbanPageId: Id,
  questionsPageId: Id,
});
export type TutorialSeed = z.infer<typeof TutorialSeed>;

export const TutorialState = z.object({
  status: TutorialStatus,
  completed: z.array(TutorialStep).refine((s) => new Set(s).size === s.length, "duplicate steps"),
  projectId: z.string().min(1).nullable(),
  startedAt: z.number().nullable(),
  seenViews: z.array(TutorialView),
  seed: TutorialSeed.nullable(),
});
export type TutorialState = z.infer<typeof TutorialState>;

export const TUTORIAL_NEVER: TutorialState = {
  status: "never",
  completed: [],
  projectId: null,
  startedAt: null,
  seenViews: [],
  seed: null,
};

export function currentStep(s: TutorialState): TutorialStep | null {
  if (s.status !== "active" && s.status !== "paused") return null;
  return TUTORIAL_STEPS.find((step) => !s.completed.includes(step)) ?? null;
}

export const DEMO_PROJECT_KEY = "DEMO";
