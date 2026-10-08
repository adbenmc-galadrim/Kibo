export type Notifier = { emit(): void; subscribe(listener: () => void): () => void };

export function createNotifier(): Notifier {
  const listeners = new Set<() => void>();
  return {
    emit: () => {
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
