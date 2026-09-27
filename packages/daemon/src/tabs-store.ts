import { EMPTY_TABS, KiboError, salvageTabsState, TabsState } from "@kibo/schema";
import type { Store } from "./store";

const TABS_KEY = "tabs:workspace";

export function readTabs(store: Store): TabsState {
  const raw = store.getLocal(TABS_KEY);
  if (raw === null) return EMPTY_TABS;
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = TabsState.safeParse(json);
    if (parsed.success) return parsed.data;
    const salvaged = salvageTabsState(json);
    if (salvaged) {
      console.error("[kibo-daemon] stored tabs had invalid entries, dropped", parsed.error.message);
      return salvaged;
    }
    console.error("[kibo-daemon] stored tabs are invalid, starting empty", parsed.error.message);
  } catch (e) {
    console.error("[kibo-daemon] stored tabs are unreadable, starting empty", e);
  }
  return EMPTY_TABS;
}

export function saveTabs(store: Store, state: unknown): null {
  const parsed = TabsState.safeParse(state);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  store.setLocal(TABS_KEY, JSON.stringify(parsed.data));
  return null;
}
