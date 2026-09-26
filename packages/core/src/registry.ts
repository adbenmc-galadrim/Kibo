import { compareSemver, KiboError, RegistryEntry, type RegistryVersion } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

type VersionPatch = Partial<Pick<RegistryVersion, "trust" | "approvedHash" | "granted" | "autoUpdate">>;

const registry = (ws: LoroDoc) => ws.getMap("componentRegistry");

const notInstalled = (id: string, version: string) =>
  new KiboError("NOT_FOUND", `component ${id}@${version} is not installed`);

export function readRegistry(ws: LoroDoc): Record<string, RegistryEntry> {
  const raw: Record<string, unknown> = registry(ws).toJSON();
  const out: Record<string, RegistryEntry> = {};
  for (const [id, value] of Object.entries(raw)) {
    const parsed = RegistryEntry.safeParse(value);
    if (!parsed.success) throw new KiboError("STORE_CORRUPT", `registry entry ${id} is invalid`);
    out[id] = parsed.data;
  }
  return out;
}

export function getRegistryVersion(ws: LoroDoc, id: string, version: string): RegistryVersion | null {
  return readRegistry(ws)[id]?.versions[version] ?? null;
}

export function putRegistryVersion(ws: LoroDoc, id: string, title: string, v: RegistryVersion): void {
  const entry = readRegistry(ws)[id];
  registry(ws).set(id, { title, versions: { ...(entry?.versions ?? {}), [v.version]: v } });
  ws.commit();
}

export function updateRegistryVersion(
  ws: LoroDoc,
  id: string,
  version: string,
  patch: VersionPatch,
): RegistryVersion {
  const entry = readRegistry(ws)[id];
  const current = entry?.versions[version];
  if (!entry || !current) throw notInstalled(id, version);
  const next = { ...current, ...patch };
  registry(ws).set(id, { ...entry, versions: { ...entry.versions, [version]: next } });
  ws.commit();
  return next;
}

export function removeRegistryVersion(ws: LoroDoc, id: string, version: string): void {
  const entry = readRegistry(ws)[id];
  if (!entry?.versions[version]) throw notInstalled(id, version);
  const { [version]: _gone, ...rest } = entry.versions;
  if (Object.keys(rest).length === 0) registry(ws).delete(id);
  else registry(ws).set(id, { ...entry, versions: rest });
  ws.commit();
}

export function highestVersion(entry: RegistryEntry): string | null {
  return Object.keys(entry.versions).sort(compareSemver).at(-1) ?? null;
}
