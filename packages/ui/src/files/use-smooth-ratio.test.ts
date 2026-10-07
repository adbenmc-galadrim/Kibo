import { afterEach, expect, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useSmoothRatio } from "./use-smooth-ratio";

const original = window.matchMedia;
const reduceMotion = (reduce: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes("reduced-motion"), media: query }),
  });

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: original });
});

test("the shown ratio eases up to the target over several frames", async () => {
  reduceMotion(false);
  const { result, rerender } = renderHook(({ target }) => useSmoothRatio(target), {
    initialProps: { target: 0 },
  });
  rerender({ target: 1 });
  expect(result.current).toBe(0);
  await waitFor(() => expect(result.current).toBeGreaterThan(0));
  expect(result.current).toBeLessThan(1);
  await waitFor(() => expect(result.current).toBe(1));
});

test("with reduced motion, the shown ratio follows the target at once and never goes back", async () => {
  reduceMotion(true);
  const { result, rerender } = renderHook(({ target }) => useSmoothRatio(target), {
    initialProps: { target: 0 },
  });
  rerender({ target: 0.6 });
  expect(result.current).toBe(0.6);
  rerender({ target: 0.3 });
  expect(result.current).toBe(0.6);
});
