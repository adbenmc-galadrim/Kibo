import { beforeEach, expect, mock, test } from "bun:test";
import { type DesignFrame, KiboError, type RpcRequest } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../../api-mock";

const A = "https://www.figma.com/design/AbC123xyz/Silo?node-id=45-1";
const B = "https://www.figma.com/design/AbC123xyz/Silo?node-id=45-2";
const frameOf = (url: string, stale = false): DesignFrame => ({
  id: url,
  provider: "figma",
  name: url === A ? "Conflit de saisie" : "Accueil",
  width: 444,
  height: 960,
  url: "data:image/png;base64,iVBORw0KGgo=",
  mime: "image/png",
  fetchedAt: 0,
  stale,
  reachable: true,
  source: url,
});

type Pending = { req: RpcRequest; resolve(frame: DesignFrame): void; reject(error: unknown): void };
const pending: Pending[] = [];
mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        new Promise((resolve, reject) => {
          pending.push({ req, resolve, reject });
        }),
    },
  }),
);
const { useDesignThumbs } = await import("./use-design-thumbs");

const settle = (url: string, outcome: DesignFrame | Error) =>
  act(async () => {
    const at = pending.findIndex((p) => p.req.method === "getDesignFrame" && p.req.url === url);
    const [call] = pending.splice(at, 1);
    if (!call) throw new Error(`no call for ${url}`);
    if (outcome instanceof Error) call.reject(outcome);
    else call.resolve(outcome);
  });

beforeEach(() => {
  pending.length = 0;
});

test("each url is asked once without refresh and becomes ready", async () => {
  const { result } = renderHook(() => useDesignThumbs([A, B]));
  expect(pending.map((p) => p.req)).toEqual([
    { method: "getDesignFrame", url: A, refresh: false },
    { method: "getDesignFrame", url: B, refresh: false },
  ]);
  expect(result.current.thumbs.get(A)).toEqual({ state: "loading" });
  await settle(A, frameOf(A));
  expect(result.current.thumbs.get(A)).toEqual({ state: "ready", frame: frameOf(A) });
  expect(result.current.thumbs.get(B)).toEqual({ state: "loading" });
});

test("refresh asks again for that url only and keeps the frame while refreshing", async () => {
  const { result } = renderHook(() => useDesignThumbs([A, B]));
  await settle(A, frameOf(A));
  await settle(B, frameOf(B));
  act(() => result.current.refresh(A));
  expect(pending.map((p) => p.req)).toEqual([{ method: "getDesignFrame", url: A, refresh: true }]);
  expect(result.current.refreshing(A)).toBe(true);
  expect(result.current.refreshing(B)).toBe(false);
  expect(result.current.thumbs.get(A)).toEqual({ state: "ready", frame: frameOf(A) });
  await settle(A, frameOf(A, true));
  expect(result.current.refreshing(A)).toBe(false);
  expect(result.current.thumbs.get(A)).toEqual({ state: "ready", frame: frameOf(A, true) });
});

test("a failure is kept with its error, and a retry loads again", async () => {
  const { result } = renderHook(() => useDesignThumbs([A]));
  const error = new KiboError("REMOTE_UNAVAILABLE", "down");
  await settle(A, error);
  expect(result.current.thumbs.get(A)).toEqual({ state: "failed", error });
  act(() => result.current.refresh(A));
  expect(result.current.thumbs.get(A)).toEqual({ state: "loading" });
  await settle(A, frameOf(A));
  expect(result.current.thumbs.get(A)?.state).toBe("ready");
});

test("a url removed from the list is forgotten, its late answer ignored", async () => {
  const { result, rerender } = renderHook(({ urls }) => useDesignThumbs(urls), {
    initialProps: { urls: [A, B] },
  });
  await settle(A, frameOf(A));
  rerender({ urls: [A] });
  expect([...result.current.thumbs.keys()]).toEqual([A]);
  await settle(B, frameOf(B));
  rerender({ urls: [A, B] });
  await waitFor(() =>
    expect(pending.map((p) => p.req.method === "getDesignFrame" && p.req.url)).toEqual([B]),
  );
  expect(result.current.thumbs.get(B)).toEqual({ state: "loading" });
});
