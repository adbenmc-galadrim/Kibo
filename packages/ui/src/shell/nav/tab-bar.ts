import type { TabsState } from "@kibo/schema";

export const showTabBar = (state: Pick<TabsState, "tabs">, error: string | null): boolean =>
  state.tabs.length > 1 || error !== null;
