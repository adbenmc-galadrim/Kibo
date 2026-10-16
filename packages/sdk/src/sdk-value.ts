import { useEffect, useState } from "react";
import type { KiboSdk } from "./types";

export type Read<T> = (sdk: KiboSdk) => Promise<T>;
export type Watch = (sdk: KiboSdk, listener: () => void) => () => void;

export function useSdkValue<T>(sdk: KiboSdk, read: Read<T>, watch: Watch, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      read(sdk).then(
        (v) => alive && setValue(v),
        (e: unknown) => console.error(`[kibo-sdk] ${sdk.instanceId}: cannot read a project value`, e),
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
