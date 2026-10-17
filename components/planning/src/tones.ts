import type { StepTone } from "./planning-model";

export const TONE_BG: Record<StepTone, string> = {
  done: "bg-(--tracking-fg)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  todo: "bg-(--tracking-border)",
};

export const TONES: readonly StepTone[] = ["done", "review", "progress", "blocked", "todo"];
