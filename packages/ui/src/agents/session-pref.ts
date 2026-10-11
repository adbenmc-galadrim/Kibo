function withSession<T>(key: string, work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.sessionStorage);
  } catch (e) {
    console.error(`session preference ${key} unavailable`, e);
    return fallback;
  }
}

export const readSessionPref = (key: string): string | null => withSession(key, (s) => s.getItem(key), null);

export function writeSessionPref(key: string, value: string | null): void {
  withSession(key, (s) => (value === null ? s.removeItem(key) : s.setItem(key, value)), undefined);
}
