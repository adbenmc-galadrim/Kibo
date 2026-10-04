import type { Selection } from "@kibo/schema";
import { createSignal, type SelectionApi, selectionApi } from "@kibo/sdk";

export type SelectionBus = {
  api(participates: boolean, log?: (line: string) => void): SelectionApi;
  current(): Selection | null;
};

const warn = (line: string) => console.warn(`[kibo-ui] ${line}`);

export function createSelectionBus(): SelectionBus {
  const signal = createSignal<Selection | null>(null);
  return {
    current: signal.get,
    api(participates, log = warn) {
      if (participates) return selectionApi(signal);
      return {
        get: () => null,
        set: () => log("selection ignored: the component does not declare selection"),
        subscribe: () => () => undefined,
      };
    },
  };
}
