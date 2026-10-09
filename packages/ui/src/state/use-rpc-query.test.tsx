import { expect, mock, test } from "bun:test";
import { KiboError, type Phase7Event, type RpcRequest } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

const requests: RpcRequest[] = [];
const listeners = new Set<(e: Phase7Event) => void>();
let answer: () => Promise<unknown> = () => Promise.resolve([]);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        requests.push(req);
        return answer();
      },
      subscribeEvents: (listener: (e: Phase7Event) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  }),
);

const unmockedModule = "./use-rpc-query?unmocked";
const { useRpcQuery }: typeof import("./use-rpc-query") = await import(unmockedModule);

const emit = (e: Phase7Event) => {
  for (const l of listeners) l(e);
};

test("loads once, reloads on the listed events only, and unsubscribes on unmount", async () => {
  requests.length = 0;
  answer = () => Promise.resolve([]);
  const hook = renderHook(() => useRpcQuery({ method: "listSessions" }, ["sessions.changed"]));
  await waitFor(() => expect(hook.result.current.data).toEqual([]));
  hook.rerender();
  expect(requests).toHaveLength(1);
  act(() => emit({ type: "sandbox.changed" }));
  expect(requests).toHaveLength(1);
  act(() => emit({ type: "sessions.changed" }));
  await waitFor(() => expect(requests).toHaveLength(2));
  hook.unmount();
  expect(listeners.size).toBe(0);
});

test("a daemon error is exposed as a KiboError", async () => {
  answer = () => Promise.reject(new KiboError("FORBIDDEN", "local session required"));
  const hook = renderHook(() => useRpcQuery({ method: "getSandboxStatus" }, []));
  await waitFor(() => expect(hook.result.current.error?.code).toBe("FORBIDDEN"));
  expect(hook.result.current.data).toBeNull();
  hook.unmount();
});
