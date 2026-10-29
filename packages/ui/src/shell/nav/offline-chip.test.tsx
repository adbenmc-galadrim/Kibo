import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";

let online = true;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const real = await import("../../state/use-agents");
mock.module("../../state/use-agents", () => ({
  ...real,
  useDaemonOnline: () => useSyncExternalStore(subscribe, () => online),
}));

const { OfflineChip } = await import("./OfflineChip");

afterEach(() => {
  cleanup();
  online = true;
});

const setOnline = (value: boolean) =>
  act(() => {
    online = value;
    for (const listener of listeners) listener();
  });

test("nothing is rendered while the daemon answers", () => {
  const { container } = render(<OfflineChip />);
  expect(container.innerHTML).toBe("");
  expect(screen.queryByRole("status")).toBeNull();
});

test("Hors connexion · reconnexion… with role status when the daemon is unreachable", () => {
  render(<OfflineChip />);
  setOnline(false);
  const chip = screen.getByRole("status", { name: "Hors connexion · reconnexion…" });
  expect(chip.textContent).toBe("Hors connexion · reconnexion…");
  setOnline(true);
  expect(screen.queryByRole("status")).toBeNull();
});
