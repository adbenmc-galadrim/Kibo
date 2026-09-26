import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useOpened } from "./use-opened";

test("stays false while never opened", () => {
  const { result, rerender } = renderHook(({ open }) => useOpened(open), { initialProps: { open: false } });
  rerender({ open: false });
  expect(result.current).toBe(false);
});

test("is true from the first opening and stays true once closed", () => {
  const { result, rerender } = renderHook(({ open }) => useOpened(open), { initialProps: { open: false } });
  rerender({ open: true });
  expect(result.current).toBe(true);
  rerender({ open: false });
  expect(result.current).toBe(true);
});

test("is true when mounted open", () => {
  const { result } = renderHook(() => useOpened(true));
  expect(result.current).toBe(true);
});
