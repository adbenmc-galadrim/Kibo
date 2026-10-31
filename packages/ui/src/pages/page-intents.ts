import type { Spotlight } from "@kibo/schema";

export type PageIntent = { token: number; intent: Spotlight };

type PageIntents = {
  request(pageId: string, intent: Spotlight): void;
  take(pageId: string): PageIntent | null;
  clear(): void;
  subscribe(listener: () => void): () => void;
};

export function createPageIntents(): PageIntents {
  const pending = new Map<string, PageIntent>();
  const listeners = new Set<() => void>();
  let last = 0;
  return {
    request(pageId, intent) {
      pending.clear();
      last += 1;
      pending.set(pageId, { token: last, intent });
      for (const l of listeners) l();
    },
    clear: () => pending.clear(),
    take(pageId) {
      const entry = pending.get(pageId) ?? null;
      pending.delete(pageId);
      return entry;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const pageIntents: PageIntents = createPageIntents();
