import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { IntegrationEvent } from "@kibo/schema";
import { act, cleanup, render, screen } from "@testing-library/react";

const listeners = new Set<(e: IntegrationEvent) => void>();
mock.module("../api", () => ({
  client: {
    subscribeIntegrations: (l: (e: IntegrationEvent) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));
const { IntegrationNotices } = await import("./IntegrationNotices");

const emit = (e: IntegrationEvent) =>
  act(() => {
    for (const l of listeners) l(e);
  });

type Shown = { title: string; body: string | undefined };
const shown: Shown[] = [];
class FakeNotification {
  static permission = "granted";
  onclick: (() => void) | null = null;
  constructor(title: string, opts?: { body?: string }) {
    shown.push({ title, body: opts?.body });
  }
}
const original = globalThis.Notification;
const notice: IntegrationEvent = {
  type: "notice",
  title: "CI cassée sur KIB-7",
  body: "CI a échoué sur la PR #12.",
};

beforeEach(() => {
  shown.length = 0;
  Object.defineProperty(globalThis, "Notification", {
    value: FakeNotification,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(globalThis, "Notification", { value: original, configurable: true, writable: true });
});

test("a sync conflict is shown as a toast", async () => {
  render(<IntegrationNotices notifications="native" />);
  await emit({ type: "sync.conflict", projectId: "p1", ticketKey: "KIB-7", field: "title" });
  expect(await screen.findByText("Conflit résolu sur KIB-7 : titre repris de GitHub")).toBeDefined();
});

test("a notice becomes a system notification in browser mode", async () => {
  render(<IntegrationNotices notifications="browser" />);
  await emit(notice);
  expect(shown).toEqual([{ title: "CI cassée sur KIB-7", body: "CI a échoué sur la PR #12." }]);
});

test("in native mode the daemon already notified, the UI does not repeat it", async () => {
  render(<IntegrationNotices notifications="native" />);
  await emit(notice);
  expect(shown).toEqual([]);
});

test("without permission no notification is shown", async () => {
  FakeNotification.permission = "denied";
  render(<IntegrationNotices notifications="browser" />);
  await emit(notice);
  FakeNotification.permission = "granted";
  expect(shown).toEqual([]);
});

test("unmounting stops listening", () => {
  const { unmount } = render(<IntegrationNotices notifications="browser" />);
  expect(listeners.size).toBe(1);
  unmount();
  expect(listeners.size).toBe(0);
});
