import type { Screen, TabTarget } from "@kibo/schema";

const EXECUTION_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "skills"]);
const RETIRED_SCREENS: ReadonlySet<Screen> = new Set([
  ...EXECUTION_SCREENS,
  "creations",
  "components",
  "sources",
  "domains",
]);

export const isExecutionScreen = (screen: Screen | null): boolean =>
  screen !== null && EXECUTION_SCREENS.has(screen);

export const isRetiredScreen = (screen: Screen | null): boolean =>
  screen !== null && RETIRED_SCREENS.has(screen);

export const isRetiredTarget = (target: TabTarget): boolean =>
  target.kind === "run" ||
  target.kind === "skill" ||
  target.kind === "changes" ||
  (target.kind === "screen" && isRetiredScreen(target.screen));

export const isExecutionTarget = isRetiredTarget;
