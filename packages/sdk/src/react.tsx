import {
  type EntityType,
  KiboError,
  type MemberInfo,
  type PresencePeer,
  type ProjectSyncInfo,
} from "@kibo/schema";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { EntityMap, KiboSdk } from "./types";

const SdkContext = createContext<KiboSdk | null>(null);

export function SdkProvider({ sdk, children }: { sdk: KiboSdk; children: ReactNode }) {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export function useSdk(): KiboSdk {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error("useSdk must be used inside <SdkProvider>");
  return sdk;
}

export type EntitiesState<T extends EntityType> = {
  data: EntityMap[T][];
  error: KiboError | null;
  loading: boolean;
};

export function useEntities<T extends EntityType>(type: T): EntitiesState<T> {
  const sdk = useSdk();
  const [state, setState] = useState<EntitiesState<T>>({ data: [], error: null, loading: true });
  useEffect(() => {
    let alive = true;
    const load = () =>
      sdk.list(type).then(
        (data) => alive && setState({ data, error: null, loading: false }),
        (e: unknown) => {
          const error = e instanceof KiboError ? e : new KiboError("INVALID_INPUT", String(e));
          if (alive) setState((s) => ({ ...s, error, loading: false }));
        },
      );
    void load();
    const off = sdk.subscribe(() => void load(), type);
    return () => {
      alive = false;
      off();
    };
  }, [sdk, type]);
  return state;
}

const EMPTY_SHARING: ProjectSyncInfo = {
  shared: false,
  keyAllocator: "local",
  role: null,
  access: "write",
  members: [],
};

type Read<T> = (sdk: KiboSdk) => Promise<T>;
type Watch = (sdk: KiboSdk, listener: () => void) => () => void;

function useSdkValue<T>(read: Read<T>, watch: Watch, initial: T): T {
  const sdk = useSdk();
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      read(sdk).then(
        (v) => alive && setValue(v),
        (e: unknown) => console.error(`[kibo-sdk] ${sdk.instanceId}: cannot read sharing or presence`, e),
      );
    void load();
    const off = watch(sdk, () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [sdk, read, watch]);
  return value;
}

const readPresence: Read<PresencePeer[]> = (sdk) => sdk.presence.list();
const watchPresence: Watch = (sdk, l) => sdk.presence.subscribe(l);
const readSharing: Read<ProjectSyncInfo> = (sdk) => sdk.sharing();
const watchProject: Watch = (sdk, l) => sdk.subscribe(l);
const NO_PEERS: PresencePeer[] = [];

export function usePresence(): PresencePeer[] {
  return useSdkValue(readPresence, watchPresence, NO_PEERS);
}

export function useSharing(): ProjectSyncInfo {
  return useSdkValue(readSharing, watchProject, EMPTY_SHARING);
}

export function useMembers(): MemberInfo[] {
  return useSharing().members;
}

export function useReadOnly(): boolean {
  return useSharing().access !== "write";
}
