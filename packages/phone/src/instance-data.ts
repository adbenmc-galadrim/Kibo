import { KiboError } from "@kibo/schema";

export type InstanceDataStore = {
  get(projectId: string, instanceId: string, key: string): unknown;
  set(projectId: string, instanceId: string, key: string, value: unknown): void;
  delete(projectId: string, instanceId: string, key: string): void;
  keys(projectId: string, instanceId: string): string[];
};

const PREFIX = "kibo.phone.data";

const prefixOf = (projectId: string, instanceId: string) =>
  `${PREFIX}:${encodeURIComponent(projectId)}:${encodeURIComponent(instanceId)}:`;

function parseStored(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("INVALID_INPUT", "stored instance data is not JSON");
  }
}

export function createInstanceData(storage: Storage): InstanceDataStore {
  return {
    get: (projectId, instanceId, key) => parseStored(storage.getItem(prefixOf(projectId, instanceId) + key)),
    set: (projectId, instanceId, key, value) =>
      storage.setItem(prefixOf(projectId, instanceId) + key, JSON.stringify(value)),
    delete: (projectId, instanceId, key) => storage.removeItem(prefixOf(projectId, instanceId) + key),
    keys(projectId, instanceId) {
      const prefix = prefixOf(projectId, instanceId);
      const found: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (name?.startsWith(prefix)) found.push(name.slice(prefix.length));
      }
      return found.sort();
    },
  };
}
