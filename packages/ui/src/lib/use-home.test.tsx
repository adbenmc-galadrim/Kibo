import { beforeEach, expect, mock, test } from "bun:test";
import type { AppInfo } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { appInfoFixture } from "./app-info-fixture";

let info: AppInfo | Error = appInfoFixture("/Users/adam");
mock.module("../api", () =>
  apiMock({
    client: { rpc: async () => (info instanceof Error ? Promise.reject(info) : info) },
  }),
);
const { useHome } = await import("./use-home");

beforeEach(() => {
  info = appInfoFixture("/Users/adam");
});

test("the user home is the absolute userHome of a local session", async () => {
  const { result } = renderHook(() => useHome());
  expect(result.current).toBeUndefined();
  await waitFor(() => expect(result.current).toBe("/Users/adam"));
});

test("the Kibo data folder ~/.kibo is never taken for the user home", async () => {
  info = appInfoFixture(null);
  const { result } = renderHook(() => useHome());
  await waitFor(() => expect(result.current).toBeNull());
});

test("an unreadable app info leaves no user home", async () => {
  info = new Error("down");
  const { result } = renderHook(() => useHome());
  await waitFor(() => expect(result.current).toBeNull());
});
