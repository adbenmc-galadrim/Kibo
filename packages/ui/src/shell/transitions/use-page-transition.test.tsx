import { afterEach, expect, mock, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { usePageTransition } from "./use-page-transition";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  window.matchMedia = originalMatchMedia;
});

function installViewTransition() {
  const updates: (() => void)[] = [];
  const start = mock((update: () => void) => {
    updates.push(update);
  });
  Object.assign(document, { startViewTransition: start });
  const runUpdates = () =>
    act(() => {
      for (const update of updates.splice(0)) update();
    });
  return { start, runUpdates };
}

function reduceMotion() {
  const query = (media: string) => ({ matches: media === "(prefers-reduced-motion: reduce)" });
  window.matchMedia = query as unknown as typeof window.matchMedia;
}

function Page({ path, body = path }: { path: string; body?: string }) {
  return <p>{usePageTransition(body, path)}</p>;
}

test("wraps the route update in startViewTransition when available", () => {
  const { start, runUpdates } = installViewTransition();
  const view = render(<Page path="a" />);
  expect(start).toHaveBeenCalledTimes(0);

  view.rerender(<Page path="b" />);
  expect(start).toHaveBeenCalledTimes(1);
  expect(screen.getByText("a")).toBeTruthy();

  runUpdates();
  expect(screen.getByText("b")).toBeTruthy();
});

test("updates immediately without startViewTransition", () => {
  const view = render(<Page path="a" />);
  view.rerender(<Page path="b" />);
  expect(screen.getByText("b")).toBeTruthy();
});

test("skips the transition under prefers-reduced-motion", () => {
  const { start } = installViewTransition();
  reduceMotion();
  const view = render(<Page path="a" />);
  view.rerender(<Page path="b" />);
  expect(start).toHaveBeenCalledTimes(0);
  expect(screen.getByText("b")).toBeTruthy();
});

test("the same route keeps its live content without any transition", () => {
  const { start } = installViewTransition();
  const view = render(<Page path="a" body="before" />);
  view.rerender(<Page path="a" body="after" />);
  expect(start).toHaveBeenCalledTimes(0);
  expect(screen.getByText("after")).toBeTruthy();
});

test("a quick second navigation lands on the latest route", () => {
  const { runUpdates } = installViewTransition();
  const view = render(<Page path="a" />);
  view.rerender(<Page path="b" />);
  view.rerender(<Page path="c" />);
  runUpdates();
  expect(screen.getByText("c")).toBeTruthy();
});
