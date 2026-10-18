import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

let answer: () => Promise<unknown> = async () => ({ today: "2026-10-16" });
let calls = 0;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: { method: string }) => {
        if (req.method !== "getAppInfo") throw new Error(`unexpected rpc ${req.method}`);
        calls += 1;
        return answer();
      },
      subscribe: () => () => {},
    },
  }),
);

const { useDaemonToday } = await import("./use-daemon-today");

beforeEach(() => {
  calls = 0;
  setSystemTime(new Date(2026, 9, 18, 10));
});
afterEach(() => setSystemTime());

test("the day is the one the daemon reports, not the browser's", async () => {
  const { result } = renderHook(() => useDaemonToday());
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).toBe("2026-10-16"));
  expect(calls).toBe(1);
});

test("without an answer from the daemon there is no day at all", async () => {
  answer = () => Promise.reject(new Error("offline"));
  const { result } = renderHook(() => useDaemonToday());
  await waitFor(() => expect(calls).toBe(1));
  expect(result.current).toBeNull();
  answer = async () => ({ today: "2026-10-16" });
});

test("an explicit instant overrides the daemon without asking it", () => {
  const { result } = renderHook(() => useDaemonToday(new Date(2026, 9, 14, 9).getTime()));
  expect(result.current).toBe("2026-10-14");
  expect(calls).toBe(0);
});
