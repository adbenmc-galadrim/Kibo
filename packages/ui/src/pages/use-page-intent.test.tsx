import { expect, test } from "bun:test";
import type { Spotlight } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import { pageIntents } from "./page-intents";
import { usePageSpotlight } from "./use-page-intent";

test("the page aims at its intent first, then at the question of its address, with a stable value", () => {
  pageIntents.set("page-2", { kind: "newFeature" });
  const view = renderHook(
    ({ address }: { address: Spotlight | null }) => usePageSpotlight("page-2", address),
    {
      initialProps: { address: { kind: "question", id: "q1" } },
    },
  );
  expect(view.result.current).toEqual({ kind: "newFeature" });
  const noIntent = renderHook(
    ({ address }: { address: Spotlight | null }) => usePageSpotlight("page-3", address),
    {
      initialProps: { address: { kind: "question", id: "q1" } },
    },
  );
  const first = noIntent.result.current;
  noIntent.rerender({ address: { kind: "question", id: "q1" } });
  expect(noIntent.result.current).toBe(first);
  noIntent.rerender({ address: null });
  expect(noIntent.result.current).toBeNull();
});
