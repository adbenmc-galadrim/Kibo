import { type EntityType, KiboError } from "@kibo/schema";
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
    const off = sdk.subscribe(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, [sdk, type]);
  return state;
}
