import type { PhoneEvent, RemoteKeys } from "@kibo/remote";
import { installClient } from "@kibo/ui/api";
import { projectStore } from "@kibo/ui/project-store";
import { createInstanceData } from "./instance-data";
import { createKeyStore, type KeyStore } from "./key-store";
import type { PasskeyPort } from "./pairing";
import type { PresenceChannel } from "./presence";
import { createRemoteClient, type RemoteClient } from "./remote-client";
import type { ServerApi } from "./server-api";
import { createSnapshotStore, type SnapshotStore } from "./snapshot-store";
import type { PhoneStorage } from "./storage";

export type PresenceHandlers = {
  onEvent(event: PhoneEvent): void;
  onOpen(): void;
  onRevoked(): void;
  onResume(): void;
  onUnopened(): void;
};

export type Keyring = { current: RemoteKeys | null };

export type PhoneRuntime = {
  api: ServerApi;
  passkeys: PasskeyPort;
  keyStore: KeyStore;
  snapshots: SnapshotStore;
  keyring: Keyring;
  client: RemoteClient;
  presence: PresenceChannel;
  onRevoked(listener: () => void): () => void;
  onSessionExpired(listener: () => void): () => void;
};

type RuntimeDeps = {
  api: ServerApi;
  storage: PhoneStorage;
  data: Storage;
  passkeys: PasskeyPort;
  presence(handlers: PresenceHandlers): PresenceChannel;
};

const report = (what: string) => (e: unknown) => console.error(`[kibo-phone] ${what} failed`, e);

export function createPhoneRuntime(deps: RuntimeDeps): PhoneRuntime {
  const keyring: Keyring = { current: null };
  const snapshots = createSnapshotStore(deps.storage.snapshots);
  const revokedListeners = new Set<() => void>();
  const expiredListeners = new Set<() => void>();
  const each = (set: Set<() => void>) => {
    for (const l of [...set]) l();
  };
  const checkSession = async () => {
    if (!(await deps.api.session())) each(expiredListeners);
  };
  let client: RemoteClient | null = null;
  const presence = deps.presence({
    onEvent: (event) => void client?.handleEvent(event).catch(report("snapshot refresh")),
    onOpen: () => void client?.sync().catch(report("sync")),
    onRevoked: () => each(revokedListeners),
    onResume: () => client?.markStale(),
    onUnopened: () => void checkSession().catch(report("session check")),
  });
  client = createRemoteClient({
    api: deps.api,
    keys: () => keyring.current,
    snapshots,
    presence,
    data: createInstanceData(deps.data),
  });
  installClient(client);
  projectStore.reset();
  return {
    api: deps.api,
    passkeys: deps.passkeys,
    keyStore: createKeyStore(deps.storage.keys),
    snapshots,
    keyring,
    client,
    presence,
    onRevoked(listener) {
      revokedListeners.add(listener);
      return () => revokedListeners.delete(listener);
    },
    onSessionExpired(listener) {
      expiredListeners.add(listener);
      return () => expiredListeners.delete(listener);
    },
  };
}
