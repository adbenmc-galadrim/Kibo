import { KiboError } from "@kibo/schema";
import type { LoroDoc, LoroMap } from "loro-crdt";

type Parsed<T> = { success: true; data: T } | { success: false; error: { message: string } };

export const profilesMap = (doc: LoroDoc) => doc.getMap("profiles");
export const domainsMap = (doc: LoroDoc) => doc.getMap("domains");
export const guidelinesMap = (doc: LoroDoc) => doc.getMap("guidelines");
export const settingsMap = (doc: LoroDoc) => doc.getMap("settings");
export const projectIdOf = (doc: LoroDoc) => doc.getMap("meta").get("id") as string | undefined;
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");

export function valid<T>(result: Parsed<T>): T {
  if (!result.success) throw new KiboError("INVALID_INPUT", result.error.message);
  return result.data;
}

export function stored<T>(result: Parsed<T>, what: string): T {
  if (!result.success) throw new KiboError("STORE_CORRUPT", `${what}: ${result.error.message}`);
  return result.data;
}

export function entries(map: LoroMap): unknown[] {
  return Object.values(map.toJSON() as Record<string, unknown>);
}

export function requireWorkspace(doc: LoroDoc): void {
  if (projectIdOf(doc) !== undefined) {
    throw new KiboError("INVALID_INPUT", "profiles, domains and shared guidelines live in the workspace");
  }
}

export function assertUniqueName(
  existing: { id: string; name: string }[],
  item: { id: string; name: string },
): void {
  const clash = existing.some((e) => e.id !== item.id && e.name.toLowerCase() === item.name.toLowerCase());
  if (clash) throw new KiboError("INVALID_INPUT", `name ${item.name} is already used`);
}
