import { INDEX_PROJECT_ID, type ProjectsIndex, type RemoteKeys } from "@kibo/remote";
import type { ProjectCommand } from "@kibo/schema";
import { type FakeServerApi, fakeServerApi, putBlob } from "./fake-server-api";
import { createKeyStore } from "./key-store";
import type { PasskeyPort } from "./pairing";
import type { PresenceChannel } from "./presence";
import { projectSnapshot } from "./project-fixture";
import type { Connectivity } from "./remote-client";
import { createPhoneRuntime, type PhoneRuntime, type PresenceHandlers } from "./runtime";
import { memoryStorage, type PhoneStorage } from "./storage";
import { ACCOUNT_ID, rootKey, sealJson, testKeys } from "./test-kit";

export type ManualPresence = PresenceChannel & {
  set(next: Connectivity): void;
  handlers: PresenceHandlers | null;
};

export function manualPresence(initial: Connectivity): ManualPresence {
  let state = initial;
  const listeners = new Set<() => void>();
  const presence: ManualPresence = {
    handlers: null,
    get: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start: () => undefined,
    stop: () => undefined,
    set: (next) => {
      state = next;
      for (const l of [...listeners]) l();
    },
  };
  return presence;
}

export const refusingPasskeys: PasskeyPort = {
  create: async () => {
    throw new Error("no passkey in this test");
  },
  get: async () => {
    throw new Error("no passkey in this test");
  },
};

const twoTickets = (run: (cmd: ProjectCommand) => unknown) => {
  run({ method: "createTicket", title: "Conflits de saisie" });
  run({ method: "createTicket", title: "Route d'envoi des photos" });
};

const project = (id: string, name: string, key: string, color: string) =>
  projectSnapshot({ id, name, key, color, seed: twoTickets });

const pendingBatch = {
  id: "b7",
  status: "pending",
  actions: [{ id: 1 }, { id: 2 }, { id: 3 }],
  chosen: null,
  results: [],
};

export const SILO_INDEX: ProjectsIndex = {
  viewer: "adam",
  projects: [
    { id: "silo", name: "Silo", key: "SILO", icon: null, pages: [] },
    { id: "atelier", name: "Atelier", key: "ATL", icon: null, pages: [] },
  ],
};

export type PhoneFixture = {
  api: FakeServerApi;
  keys: RemoteKeys;
  presence: ManualPresence;
  storage: PhoneStorage;
  runtime: PhoneRuntime;
};

export async function phoneFixture({
  connectivity = { macOnline: true, phoneOnline: true },
  builtAt = 1_760_619_120_000,
  serverKeys,
}: {
  connectivity?: Connectivity;
  builtAt?: number;
  serverKeys?: RemoteKeys;
} = {}): Promise<PhoneFixture> {
  const keys = await testKeys();
  const sealing = serverKeys ?? keys;
  const api = fakeServerApi(keys);
  putBlob(api, await sealJson(sealing, INDEX_PROJECT_ID, "projects", SILO_INDEX, { builtAt }));
  putBlob(
    api,
    await sealJson(sealing, "silo", "project", project("silo", "Silo", "SILO", "#14B8A6"), { builtAt }),
  );
  putBlob(
    api,
    await sealJson(sealing, "atelier", "project", project("atelier", "Atelier", "ATL", "#6366F1"), {
      builtAt,
    }),
  );
  const agent = {
    view: { session: null, run: null, batches: [pendingBatch], past: [], memoryPath: "" },
    logs: {},
  };
  putBlob(api, await sealJson(sealing, "silo", "agent", agent, { builtAt }));
  const storage = memoryStorage();
  await createKeyStore(storage.keys).save(ACCOUNT_ID, rootKey(7), 1);
  const presence = manualPresence(connectivity);
  const runtime = createPhoneRuntime({
    api,
    storage,
    data: localStorage,
    passkeys: refusingPasskeys,
    presence: (handlers) => {
      presence.handlers = handlers;
      return presence;
    },
  });
  return { api, keys, presence, storage, runtime };
}
