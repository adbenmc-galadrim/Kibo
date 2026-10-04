import { z } from "zod";

export const TUTORIAL_STEPS = ["kanban", "links", "note", "dashboard", "agent", "component"] as const;
export const TutorialStep = z.enum(TUTORIAL_STEPS);
export type TutorialStep = z.infer<typeof TutorialStep>;
export const TutorialStatus = z.enum(["never", "active", "paused", "skipped", "done"]);
export type TutorialStatus = z.infer<typeof TutorialStatus>;

const Layout = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export const TutorialSeed = z.object({
  ticketIds: z.array(z.string().min(1)),
  linkKeys: z.array(z.string().min(1)),
  layouts: z.record(z.string(), Layout),
  noteHash: z.string(),
  dashboardPageId: z.string().min(1),
  graphPageId: z.string().min(1),
});
export type TutorialSeed = z.infer<typeof TutorialSeed>;

export const TutorialState = z.object({
  status: TutorialStatus,
  completed: z.array(TutorialStep).refine((s) => new Set(s).size === s.length, "duplicate steps"),
  projectId: z.string().min(1).nullable(),
  startedAt: z.number().nullable(),
  seenViews: z.array(z.enum(["graph"])),
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
