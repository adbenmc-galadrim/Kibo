import { KiboError } from "@kibo/schema";
import { z } from "zod";
import type { Store } from "../store";

export type RemoteSettings = {
  enabled: boolean;
  serverUrl: string | null;
  accountId: string | null;
  keyEpoch: number;
  projects: string[];
  phonePaired: boolean;
  pendingRevoke: boolean;
  revokeAbandoned: boolean;
};

export type RemoteSettingsStore = {
  read(): RemoteSettings;
  write(patch: Partial<Omit<RemoteSettings, "projects">>): RemoteSettings;
  setProjects(projectIds: readonly string[]): string[];
  clear(): void;
};

const KEYS = {
  enabled: "remote.enabled",
  serverUrl: "remote.serverUrl",
  accountId: "remote.accountId",
  keyEpoch: "remote.keyEpoch",
  projects: "remote.projects",
  phonePaired: "remote.phonePaired",
  pendingRevoke: "remote.pendingRevoke",
  revokeAbandoned: "remote.revokeAbandoned",
} as const;

const ProjectList = z.array(z.string().min(1));

const sortedUnique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

function parseProjects(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    return ProjectList.parse(JSON.parse(raw));
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${KEYS.projects} is invalid: ${String(e)}`);
  }
}

function parseEpoch(raw: string | null): number {
  if (raw === null) return 0;
  const epoch = Number(raw);
  if (!Number.isInteger(epoch) || epoch < 0)
    throw new KiboError("STORE_CORRUPT", `${KEYS.keyEpoch} is invalid: ${raw}`);
  return epoch;
}

const flag = (value: boolean) => (value ? "1" : "0");

export function openRemoteSettings(store: Pick<Store, "db" | "getLocal" | "setLocal">): RemoteSettingsStore {
  const read = (): RemoteSettings => ({
    enabled: store.getLocal(KEYS.enabled) === "1",
    serverUrl: store.getLocal(KEYS.serverUrl),
    accountId: store.getLocal(KEYS.accountId),
    keyEpoch: parseEpoch(store.getLocal(KEYS.keyEpoch)),
    projects: parseProjects(store.getLocal(KEYS.projects)),
    phonePaired: store.getLocal(KEYS.phonePaired) === "1",
    pendingRevoke: store.getLocal(KEYS.pendingRevoke) === "1",
    revokeAbandoned: store.getLocal(KEYS.revokeAbandoned) === "1",
  });
  const writeOne = (key: string, value: string | null) => {
    if (value === null) store.db.run("DELETE FROM local_state WHERE key = ?", [key]);
    else store.setLocal(key, value);
  };
  return {
    read,
    write: (patch) => {
      if (patch.enabled !== undefined) writeOne(KEYS.enabled, flag(patch.enabled));
      if (patch.serverUrl !== undefined) writeOne(KEYS.serverUrl, patch.serverUrl);
      if (patch.accountId !== undefined) writeOne(KEYS.accountId, patch.accountId);
      if (patch.keyEpoch !== undefined) writeOne(KEYS.keyEpoch, String(patch.keyEpoch));
      if (patch.phonePaired !== undefined) writeOne(KEYS.phonePaired, flag(patch.phonePaired));
      if (patch.pendingRevoke !== undefined) writeOne(KEYS.pendingRevoke, flag(patch.pendingRevoke));
      if (patch.revokeAbandoned !== undefined) writeOne(KEYS.revokeAbandoned, flag(patch.revokeAbandoned));
      return read();
    },
    setProjects: (projectIds) => {
      const projects = sortedUnique(projectIds);
      store.setLocal(KEYS.projects, JSON.stringify(projects));
      return projects;
    },
    clear: () => {
      for (const key of Object.values(KEYS)) writeOne(key, null);
    },
  };
}
