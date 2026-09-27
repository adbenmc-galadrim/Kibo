import { KiboError, type Phase7Event, type RpcRequest, type RpcResult } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type ChangeType = Phase7Event["type"];

export type RpcQuery<M extends RpcRequest["method"]> = {
  data: RpcResult[M] | null;
  error: KiboError | null;
  reload(): void;
};

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));

export function useRpcQuery<R extends RpcRequest>(
  req: R,
  refreshOn: readonly ChangeType[],
): RpcQuery<R["method"]> {
  const [data, setData] = useState<RpcResult[R["method"]] | null>(null);
  const [error, setError] = useState<KiboError | null>(null);
  const request = useRef(req);
  request.current = req;
  const live = useRef(true);
  const key = JSON.stringify(req);
  const events = refreshOn.join(",");
  const reload = useCallback(() => {
    void key;
    client.rpc(request.current).then(
      (result) => {
        if (!live.current) return;
        setData(result);
        setError(null);
      },
      (e: unknown) => {
        if (live.current) setError(asKiboError(e));
      },
    );
  }, [key]);
  useEffect(() => {
    live.current = true;
    reload();
    const types = new Set(events.split(","));
    const off = client.subscribeEvents((event) => {
      if (types.has(event.type)) reload();
    });
    return () => {
      live.current = false;
      off();
    };
  }, [reload, events]);
  return { data, error, reload };
}
