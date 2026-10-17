import type { Screen } from "@kibo/schema";

const EXECUTION_SCREENS: ReadonlySet<Screen> = new Set(["agents", "queue", "skills"]);

export const isExecutionScreen = (screen: Screen | null): boolean =>
  screen !== null && EXECUTION_SCREENS.has(screen);
