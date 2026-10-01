function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.map(([key, inner]) => [key, sortedKeys(inner)]));
}

export const canonicalJson = (value: unknown): string => JSON.stringify(sortedKeys(value));

export const sameJson = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
