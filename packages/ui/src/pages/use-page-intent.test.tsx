import { expect, test } from "bun:test";
import type { Spotlight } from "@kibo/schema";
import { act, renderHook } from "@testing-library/react";
import { pageIntents } from "./page-intents";
import { usePageSpotlight } from "./use-page-intent";

const mount = (pageId: string, address: Spotlight | null) =>
  renderHook(({ at }: { at: Spotlight | null }) => usePageSpotlight(pageId, at), {
    initialProps: { at: address },
  });

test("the page aims at its intent, then at the question of its address, with a stable value", () => {
  pageIntents.request("page-2", { kind: "newFeature" });
  expect(mount("page-2", null).result.current).toEqual({ kind: "newFeature" });
  const noIntent = mount("page-3", { kind: "question", id: "q1" });
  const first = noIntent.result.current;
  noIntent.rerender({ at: { kind: "question", id: "q1" } });
  expect(noIntent.result.current).toBe(first);
  noIntent.rerender({ at: null });
  expect(noIntent.result.current).toBeNull();
});

test("a question opened after an intent, on the same page, wins over it", () => {
  const page = mount("page-4", null);
  act(() => pageIntents.request("page-4", { kind: "newQuestion", ticketId: "f5" }));
  expect(page.result.current).toEqual({ kind: "newQuestion", ticketId: "f5" });
  page.rerender({ at: { kind: "question", id: "q1" } });
  expect(page.result.current).toEqual({ kind: "question", id: "q1" });
});

test("the same intent asked twice is two distinct requests", () => {
  const page = mount("page-5", null);
  act(() => pageIntents.request("page-5", { kind: "newFeature" }));
  const first = page.result.current;
  page.rerender({ at: null });
  expect(page.result.current).toBe(first);
  act(() => pageIntents.request("page-5", { kind: "newFeature" }));
  expect(page.result.current).toEqual({ kind: "newFeature" });
  expect(page.result.current).not.toBe(first);
});
