import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { useFollowBottom } from "./use-follow-bottom";

const callbacks: (() => void)[] = [];
const original = globalThis.ResizeObserver;

class FakeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    callbacks.push(() => callback([], this));
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  callbacks.length = 0;
  globalThis.ResizeObserver = FakeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
});

function Scroller({ count }: { count: number }) {
  const { ref, onScroll, release } = useFollowBottom<HTMLDivElement>(count);
  return (
    <div ref={ref} onScroll={onScroll} data-testid="scroller">
      <button type="button" onClick={release}>
        lâcher
      </button>
    </div>
  );
}

function sized(el: HTMLElement) {
  let height = 400;
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => height });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 100 });
  return (next: number) => {
    height = next;
  };
}

test("the scroller stays at the bottom when its content grows without a new item", () => {
  render(<Scroller count={1} />);
  const el = screen.getByTestId("scroller");
  const grow = sized(el);
  grow(700);
  act(() => {
    for (const cb of callbacks) cb();
  });
  expect(el.scrollTop).toBe(700);
});

test("a reader who scrolled up is left where they are when the content grows", () => {
  render(<Scroller count={1} />);
  const el = screen.getByTestId("scroller");
  const grow = sized(el);
  el.scrollTop = 50;
  el.dispatchEvent(new Event("scroll"));
  grow(900);
  act(() => {
    for (const cb of callbacks) cb();
  });
  expect(el.scrollTop).toBe(50);
});

test("a released scroller no longer follows the bottom, until the reader comes back down", () => {
  render(<Scroller count={1} />);
  const el = screen.getByTestId("scroller");
  const grow = sized(el);
  el.scrollTop = 120;
  act(() => screen.getByRole("button").click());
  grow(900);
  act(() => {
    for (const cb of callbacks) cb();
  });
  expect(el.scrollTop).toBe(120);
  el.scrollTop = 800;
  el.dispatchEvent(new Event("scroll"));
  grow(1200);
  act(() => {
    for (const cb of callbacks) cb();
  });
  expect(el.scrollTop).toBe(1200);
});
