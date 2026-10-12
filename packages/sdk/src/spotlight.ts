import type { Spotlight } from "@kibo/schema";
import { createSignal } from "./signal";
import type { SpotlightApi } from "./types";

export type SpotlightStore = SpotlightApi & { set(spotlight: Spotlight | null): void };

export function createSpotlightStore(initial: Spotlight | null = null): SpotlightStore {
  const signal = createSignal<Spotlight | null>(initial);
  return { get: signal.get, set: signal.set, subscribe: signal.subscribe };
}

export const NO_SPOTLIGHT: SpotlightApi = createSpotlightStore();
