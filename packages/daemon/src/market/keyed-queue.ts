export type KeyedQueue = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const next = (tails.get(key) ?? Promise.resolve()).then(task, task);
    tails.set(key, next);
    const release = () => {
      if (tails.get(key) === next) tails.delete(key);
    };
    next.then(release, release);
    return next;
  };
}
