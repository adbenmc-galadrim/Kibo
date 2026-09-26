import { expect, mock, test } from "bun:test";
import type { IntegrationEvent, RpcRequest, SyncState } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";

const requests: RpcRequest[] = [];
const listeners = new Set<(e: IntegrationEvent) => void>();
const empty: SyncState = { connected: true, bindings: [], pending: [], errors: [] };

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      requests.push(req);
      return Promise.resolve(empty);
    },
    subscribeIntegrations: (l: (e: IntegrationEvent) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));

const { useSyncState } = await import("./use-sync-state");

const emit = (e: IntegrationEvent) =>
  act(async () => {
    for (const l of listeners) l(e);
  });

test("the sync state reloads on its project's sync events only", async () => {
  const { result, unmount } = renderHook(() => useSyncState("p1"));
  await waitFor(() => expect(result.current.state).toEqual(empty));
  expect(requests).toEqual([{ method: "getSyncState", projectId: "p1" }]);
  await emit({ type: "sync", projectId: "p2", bindingId: "b", imported: 0, running: false });
  expect(requests).toHaveLength(1);
  await emit({ type: "sync", projectId: "p1", bindingId: "b", imported: 3, running: true });
  await emit({ type: "integrations" });
  await emit({ type: "sync.outbox", projectId: "p2", bindingId: "b" });
  expect(requests).toHaveLength(3);
  await emit({ type: "sync.outbox", projectId: "p1", bindingId: "b" });
  expect(requests).toHaveLength(4);
  unmount();
  expect(listeners.size).toBe(0);
});
