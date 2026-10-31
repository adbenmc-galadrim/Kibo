import {
  DEFAULT_RECIPIENTS,
  type EntityType,
  KiboError,
  type QuestionRecipient,
  type Selection,
  type Spotlight,
} from "@kibo/schema";
import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { type Read, useSdkValue, type Watch } from "./sdk-value";
import type { EntityMap, KiboSdk } from "./types";

const SdkContext = createContext<KiboSdk | null>(null);

export function SdkProvider({ sdk, children }: { sdk: KiboSdk; children: ReactNode }) {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export const useOptionalSdk = (): KiboSdk | null => useContext(SdkContext);

export function useSdk(): KiboSdk {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error("useSdk must be used inside <SdkProvider>");
  return sdk;
}

type EntitiesState<T extends EntityType> = {
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

export function useVisible(): boolean {
  const { visibility } = useSdk();
  return useSyncExternalStore(visibility.subscribe, visibility.visible, visibility.visible);
}

type FocusMode = { active: boolean; available: boolean; request(): void; exit(): void };

export function useFocusMode(): FocusMode {
  const sdk = useSdk();
  const active = useSyncExternalStore(sdk.focus.subscribe, sdk.focus.active, sdk.focus.active);
  return {
    active,
    available: sdk.capabilities.includes("fullscreen"),
    request: sdk.focus.request,
    exit: sdk.focus.exit,
  };
}

export function useSpotlight(): Spotlight | null {
  const { spotlight } = useSdk();
  return useSyncExternalStore(spotlight.subscribe, spotlight.get, spotlight.get);
}

export function useSelection(): [Selection | null, (selection: Selection | null) => void] {
  const { selection } = useSdk();
  return [useSyncExternalStore(selection.subscribe, selection.get, selection.get), selection.set];
}

const watchProject: Watch = (sdk, l) => sdk.subscribe(l);
const readRecipients: Read<QuestionRecipient[]> = (sdk) => sdk.questions.recipients();
const FIRST_RECIPIENTS: QuestionRecipient[] = [...DEFAULT_RECIPIENTS];

export function useQuestionRecipients(): QuestionRecipient[] {
  return useSdkValue(useSdk(), readRecipients, watchProject, FIRST_RECIPIENTS);
}
