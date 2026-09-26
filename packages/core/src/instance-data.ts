import { DataKey, INSTANCE_DATA_LIMIT, KiboError } from "@kibo/schema";
import { type LoroDoc, LoroMap } from "loro-crdt";

type Json = Record<string, unknown>;

const root = (doc: LoroDoc) => doc.getMap("instanceData");

export const dataSize = (data: Json): number => new TextEncoder().encode(JSON.stringify(data)).byteLength;

export function readInstanceData(doc: LoroDoc, instanceId: string): Json {
  const map = root(doc).get(instanceId);
  if (!(map instanceof LoroMap)) return {};
  const json: Json = map.toJSON();
  return json;
}

export function assertInstanceData(data: Json): void {
  for (const key of Object.keys(data)) {
    if (!DataKey.safeParse(key).success) throw new KiboError("INVALID_INPUT", `invalid data key ${key}`);
  }
  if (dataSize(data) > INSTANCE_DATA_LIMIT) {
    throw new KiboError("QUOTA_EXCEEDED", `instance data exceeds ${INSTANCE_DATA_LIMIT} bytes`);
  }
}

function assertInstance(doc: LoroDoc, instanceId: string): void {
  if (doc.getMap("instances").get(instanceId) === undefined) {
    throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
  }
}

const container = (doc: LoroDoc, instanceId: string): LoroMap =>
  root(doc).getOrCreateContainer(instanceId, new LoroMap());

export function writeInstanceData(doc: LoroDoc, instanceId: string, key: string, value: unknown): void {
  assertInstance(doc, instanceId);
  const removing = value === null || value === undefined;
  const next = { ...readInstanceData(doc, instanceId) };
  if (removing) delete next[key];
  else next[key] = value;
  assertInstanceData({ ...next, [key]: removing ? 0 : value });
  const map = container(doc, instanceId);
  if (removing) map.delete(key);
  else map.set(key, value);
  doc.commit();
}

export function replaceInstanceData(doc: LoroDoc, instanceId: string, data: Json): void {
  assertInstanceData(data);
  const map = container(doc, instanceId);
  map.clear();
  for (const [key, value] of Object.entries(data)) map.set(key, value);
}

export function dropInstanceData(doc: LoroDoc, instanceId: string): void {
  if (root(doc).get(instanceId) !== undefined) root(doc).delete(instanceId);
}
