import type { Screen, TabTarget } from "@kibo/schema";

const EXECUTION_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "skills"]);

export const isExecutionScreen = (screen: Screen | null): boolean =>
  screen !== null && EXECUTION_SCREENS.has(screen);

export const isExecutionTarget = (target: TabTarget): boolean =>
  target.kind === "run" ||
  target.kind === "skill" ||
  (target.kind === "screen" && isExecutionScreen(target.screen));
