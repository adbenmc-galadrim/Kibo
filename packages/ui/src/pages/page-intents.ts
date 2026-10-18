import type { Spotlight } from "@kibo/schema";

export type PageIntents = {
  set(pageId: string, intent: Spotlight): void;
  peek(pageId: string): Spotlight | null;
  take(pageId: string): Spotlight | null;
  subscribe(listener: () => void): () => void;
};

export function createPageIntents(): PageIntents {
  const pending = new Map<string, Spotlight>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    set(pageId, intent) {
      pending.set(pageId, intent);
      emit();
    },
    peek: (pageId) => pending.get(pageId) ?? null,
    take(pageId) {
      const intent = pending.get(pageId) ?? null;
      if (intent !== null) {
        pending.delete(pageId);
        emit();
      }
      return intent;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const pageIntents: PageIntents = createPageIntents();
