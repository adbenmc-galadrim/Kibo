import { Instance, inGrid, isFormatLayout } from "@kibo/schema";
import { isContainer, type LoroDoc, type LoroMap } from "loro-crdt";

const instancesOf = (doc: LoroDoc): LoroMap => doc.getMap("instances");

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.map(([key, inner]) => [key, sortedKeys(inner)]));
}

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b));

function sameEntry(before: unknown, after: unknown, beforeJson: unknown, afterJson: unknown): boolean {
  const sameKind = isContainer(after)
    ? isContainer(before) && before.id === after.id
    : !isContainer(before) && before !== undefined;
  return sameKind && sameJson(beforeJson, afterJson);
}

function changedKeys(before: LoroMap, after: LoroMap): string[] {
  const previous = new Map<string, unknown>(Object.entries(before.toJSON()));
  const current = new Map<string, unknown>(Object.entries(after.toJSON()));
  return after
    .keys()
    .filter((key) => !sameEntry(before.get(key), after.get(key), previous.get(key), current.get(key)));
}

function entryViolation(key: string, value: unknown): string | null {
  if (isContainer(value)) return `instance ${key} must be a plain value`;
  const parsed = Instance.safeParse(value);
  if (!parsed.success) return `instance ${key} has an invalid value`;
  if (parsed.data.id !== key) return `instance ${key} is stored under another key`;
  if (!inGrid(parsed.data.layout)) return `instance ${key}: layout is outside the grid`;
  if (!isFormatLayout(parsed.data.layout)) return `instance ${key}: layout is not a component format`;
  return null;
}

function firstViolation(map: LoroMap, keys: readonly string[]): string | null {
  for (const key of keys) {
    const reason = entryViolation(key, map.get(key));
    if (reason !== null) return reason;
  }
  return null;
}

export function instancesUpdateViolation(before: LoroDoc, after: LoroDoc): string | null {
  const current = instancesOf(after);
  return firstViolation(current, changedKeys(instancesOf(before), current));
}

export function instancesSnapshotViolation(doc: LoroDoc): string | null {
  const map = instancesOf(doc);
  return firstViolation(map, map.keys());
}
