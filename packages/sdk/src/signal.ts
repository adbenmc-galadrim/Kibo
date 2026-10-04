import type { Selection } from "@kibo/schema";
import type { FocusApi, SelectionApi, VisibilityApi } from "./types";

export type Signal<T> = { get(): T; set(value: T): void; subscribe(listener: () => void): () => void };

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const focusApi = (active: Signal<boolean>, onRequest: (on: boolean) => void): FocusApi => ({
  active: active.get,
  request: () => onRequest(true),
  exit: () => onRequest(false),
  subscribe: active.subscribe,
});

export const visibilityApi = (visible: Signal<boolean>): VisibilityApi => ({
  visible: visible.get,
  subscribe: visible.subscribe,
});

export const selectionApi = (
  selection: Signal<Selection | null>,
  onSet?: (next: Selection | null) => void,
): SelectionApi => ({
  get: selection.get,
  set(next) {
    selection.set(next);
    onSet?.(next);
  },
  subscribe: selection.subscribe,
});

export const NO_FOCUS: FocusApi = focusApi(createSignal(false), () => undefined);
export const ALWAYS_VISIBLE: VisibilityApi = visibilityApi(createSignal(true));
export const NO_SELECTION: SelectionApi = selectionApi(createSignal<Selection | null>(null));
