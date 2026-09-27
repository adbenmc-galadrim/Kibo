import { expect, mock, test } from "bun:test";
import type { RpcRequest, RuntimeInfo } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";

const answers: (() => Promise<RuntimeInfo>)[] = [];
const requests: RpcRequest[] = [];

const scriptedClient = () => ({
  rpc: (req: RpcRequest) => {
    requests.push(req);
    const next = answers.shift();
    return next ? next() : Promise.reject(new Error("unexpected call"));
  },
  subscribe: () => () => {},
});
mock.module("../api", () => ({ client: scriptedClient() }));

const unmockedModule = "./use-runtime-info?unmocked";
const { useRuntimeInfo }: typeof import("./use-runtime-info") = await import(unmockedModule);

test("a failure is reported, then a later mount asks again and the answer is shared", async () => {
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    answers.push(() => Promise.reject(new Error("offline")));
    const failed = renderHook(() => useRuntimeInfo());
    await waitFor(() => expect(failed.result.current.error).toBe(true));
    expect(failed.result.current.info).toBeNull();
    expect(errors).toHaveLength(1);

    answers.push(() => Promise.resolve({ sandboxOrigin: "http://127.0.0.1:4801" }));
    const first = renderHook(() => useRuntimeInfo());
    await waitFor(() =>
      expect(first.result.current.info).toEqual({ sandboxOrigin: "http://127.0.0.1:4801" }),
    );
    const second = renderHook(() => useRuntimeInfo());
    await waitFor(() => expect(second.result.current.info?.sandboxOrigin).toBe("http://127.0.0.1:4801"));
    expect(requests).toEqual([{ method: "getRuntimeInfo" }, { method: "getRuntimeInfo" }]);
  } finally {
    console.error = log;
  }
});

test("the answer is remembered per client: a replaced client is asked again", async () => {
  answers.push(() => Promise.resolve({ sandboxOrigin: "http://127.0.0.1:4801" }));
  const before = renderHook(() => useRuntimeInfo());
  await waitFor(() => expect(before.result.current.info?.sandboxOrigin).toBe("http://127.0.0.1:4801"));

  const otherRequests: RpcRequest[] = [];
  mock.module("../api", () => ({
    client: {
      rpc: (req: RpcRequest) => {
        otherRequests.push(req);
        return Promise.resolve({ sandboxOrigin: "http://127.0.0.1:4802" });
      },
      subscribe: () => () => {},
    },
  }));
  try {
    const after = renderHook(() => useRuntimeInfo());
    await waitFor(() => expect(after.result.current.info?.sandboxOrigin).toBe("http://127.0.0.1:4802"));
    expect(otherRequests).toEqual([{ method: "getRuntimeInfo" }]);
  } finally {
    mock.module("../api", () => ({ client: scriptedClient() }));
  }
});
