import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<(key: string) => void>();

function withStorage<T>(key: string, work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.localStorage);
  } catch (e) {
    console.error(`local preference ${key} unavailable`, e);
    return fallback;
  }
}

export function readPref(key: string, fallback: string): string {
  return withStorage(key, (s) => s.getItem(key), null) ?? fallback;
}

export function writePref(key: string, value: string | null): void {
  withStorage(key, (s) => (value === null ? s.removeItem(key) : s.setItem(key, value)), undefined);
  for (const listener of listeners) listener(key);
}

export function subscribePref(key: string, onChange: (external: boolean) => void): () => void {
  const onKey = (changed: string) => {
    if (changed === key) onChange(false);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === key) onChange(true);
  };
  listeners.add(onKey);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onKey);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePref(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback((onChange: () => void) => subscribePref(key, onChange), [key]);
  const value = useSyncExternalStore(subscribe, () => readPref(key, fallback));
  const set = useCallback((next: string) => writePref(key, next), [key]);
  return [value, set];
}
