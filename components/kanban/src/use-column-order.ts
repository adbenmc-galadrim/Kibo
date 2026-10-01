import type { KiboSdk } from "@kibo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ColumnOrder, ORDER_KEY } from "./column-order";
import { readColumnOrder } from "./drop";

export function useColumnOrder(sdk: KiboSdk) {
  const [order, setOrder] = useState<ColumnOrder>({});
  const [failed, setFailed] = useState(false);
  const version = useRef(0);
  const pending = useRef(0);

  const load = useCallback(() => {
    if (pending.current > 0) return;
    const asked = ++version.current;
    sdk.data.get(ORDER_KEY).then(
      (value) => {
        if (asked !== version.current || pending.current > 0) return;
        setOrder(readColumnOrder(value));
        setFailed(false);
      },
      () => {
        if (asked === version.current) setFailed(true);
      },
    );
  }, [sdk]);

  useEffect(() => {
    load();
    const unsubscribe = sdk.subscribe(load);
    return () => {
      version.current++;
      unsubscribe();
    };
  }, [sdk, load]);

  const write = useCallback(
    async (optimistic: ColumnOrder, work: () => Promise<ColumnOrder>): Promise<boolean> => {
      pending.current++;
      version.current++;
      setOrder(optimistic);
      try {
        const written = await work();
        version.current++;
        setOrder(written);
        return true;
      } catch {
        return false;
      } finally {
        pending.current--;
        if (pending.current === 0) load();
      }
    },
    [load],
  );

  return { order, failed, write };
}
