import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";

const snapshot = (id: string): ProjectSnapshot => ({
  meta: { id, name: id, key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
});
const requested: string[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getProject") requested.push(req.projectId);
      return req.method === "getProject" ? Promise.resolve(snapshot(req.projectId)) : Promise.resolve(null);
    },
    subscribe: () => () => {},
  },
}));
const unmockedModule = "./use-snapshots?unmocked";
const { useSnapshots }: typeof import("./use-snapshots") = await import(unmockedModule);

test("loads each distinct project once", async () => {
  const { result } = renderHook(() => useSnapshots(["a", "b", "a"]));
  await waitFor(() => expect(result.current.size).toBe(2));
  expect(result.current.get("b")?.meta.name).toBe("b");
  expect(requested.sort()).toEqual(["a", "b"]);
});
