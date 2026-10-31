import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { ThreadBadge } from "./ThreadBadge";
import { ACTIVE_THREAD } from "./t3-test-kit";

afterEach(cleanup);

const NOW = ACTIVE_THREAD.startedAt + 12 * 60_000;

test("running reads T3 · en cours depuis 12 min in orange, with its dot", () => {
  render(<ThreadBadge thread={ACTIVE_THREAD} now={NOW} />);
  const text = screen.getByText("T3 · en cours depuis 12 min");
  expect(text.className).toContain("--tracking-brand-text");
  expect(text.previousElementSibling?.className).toContain("--tracking-brand");
});

test("a long run is told in hours", () => {
  render(<ThreadBadge thread={ACTIVE_THREAD} now={ACTIVE_THREAD.startedAt + 125 * 60_000} />);
  expect(screen.getByText("T3 · en cours depuis 2 h 05")).toBeTruthy();
});

test("waiting reads T3 · attend ta réponse in amber", () => {
  render(<ThreadBadge thread={{ ...ACTIVE_THREAD, status: "waiting" }} now={NOW} />);
  expect(screen.getByText("T3 · attend ta réponse").className).toContain("--tracking-amber");
});

test("Ouvrir dans T3 is an anchor on the thread link", () => {
  render(<ThreadBadge thread={ACTIVE_THREAD} now={NOW} />);
  expect(screen.getByRole("link", { name: "Ouvrir dans T3" }).getAttribute("href")).toBe(ACTIVE_THREAD.link);
});

test("a thread without a link offers nothing to open", () => {
  render(<ThreadBadge thread={{ ...ACTIVE_THREAD, link: "" }} now={NOW} />);
  expect(screen.queryByRole("link")).toBeNull();
});
