import { beforeEach, expect, mock, test } from "bun:test";
import type { AutoLink, Overlap, RpcRequest } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { autoLinkFixture, OPEN_OVERLAP, overlapFixture } from "./fixtures";

const calls: RpcRequest[] = [];
const topics: { name: string; fire(): void }[] = [];
let overlaps: Overlap[] = [OPEN_OVERLAP];
let links: AutoLink[] = [autoLinkFixture()];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "overlaps.list") return Promise.resolve(overlaps);
        if (req.method === "overlaps.ignore") {
          overlaps = overlaps.map((o) => (o.id === req.id ? { ...o, status: "ignored" as const } : o));
          return Promise.resolve(overlaps[0]);
        }
        if (req.method === "autoLinks.list") return Promise.resolve(links);
        if (req.method === "autoLinks.cancel") {
          links = links.map((l) => (l.id === req.id ? { ...l, status: "cancelled" as const } : l));
          return Promise.resolve(links[0]);
        }
        return Promise.reject(new Error(`unexpected ${req.method}`));
      },
      subscribeTopic: (name: string, fire: () => void) => {
        const entry = { name, fire };
        topics.push(entry);
        return () => {
          topics.splice(topics.indexOf(entry), 1);
        };
      },
    },
  }),
);

const { useOverlaps } = await import("./use-overlaps");
const { useAutoLinks } = await import("./use-auto-links");

beforeEach(() => {
  calls.length = 0;
  topics.length = 0;
  overlaps = [OPEN_OVERLAP];
  links = [autoLinkFixture()];
});

test("the overlaps of a run are listed on mount and replayed on the agents topic", async () => {
  const { result } = renderHook(() => useOverlaps({ runId: "r-bou-15" }));
  await waitFor(() => expect(result.current.overlaps).toEqual([OPEN_OVERLAP]));
  expect(calls).toEqual([{ method: "overlaps.list", runId: "r-bou-15" }]);
  expect(topics.map((t) => t.name)).toEqual(["agents"]);
  overlaps = [OPEN_OVERLAP, overlapFixture({ id: "o2" })];
  act(() => topics[0]?.fire());
  await waitFor(() => expect(result.current.overlaps).toHaveLength(2));
});

test("ignoring an overlap asks the daemon then reloads", async () => {
  const { result } = renderHook(() => useOverlaps({ projectId: "bou" }));
  await waitFor(() => expect(result.current.overlaps).toHaveLength(1));
  await act(() => result.current.ignore("o1"));
  expect(calls.map((c) => c.method)).toEqual(["overlaps.list", "overlaps.ignore", "overlaps.list"]);
  await waitFor(() => expect(result.current.overlaps[0]?.status).toBe("ignored"));
});

test("no query, no call", () => {
  const { result, unmount } = renderHook(() => useOverlaps(null));
  expect(result.current.overlaps).toEqual([]);
  expect(calls).toEqual([]);
  unmount();
  expect(topics).toEqual([]);
});

test("the auto links of a project are indexed by link and can be cancelled", async () => {
  const { result } = renderHook(() => useAutoLinks("bou"));
  await waitFor(() => expect(result.current.links).toHaveLength(1));
  expect(result.current.byLinkId.get("l1")?.id).toBe("a1");
  expect(result.current.byId.get("a1")?.linkId).toBe("l1");
  await act(() => result.current.cancel("a1"));
  expect(calls.map((c) => c.method)).toEqual(["autoLinks.list", "autoLinks.cancel", "autoLinks.list"]);
  await waitFor(() => expect(result.current.byId.get("a1")?.status).toBe("cancelled"));
});
