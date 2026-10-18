import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { kiboProject } from "../../agents/fixtures";

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

const { SyncChip } = await import("./SyncChip");

afterEach(() => {
  cleanup();
  online = true;
});

const setOnline = (value: boolean) =>
  act(() => {
    online = value;
    for (const listener of listeners) listener();
  });

test("the daemon stopped: the chip says Hors connexion · reconnexion…, even on an unshared project", () => {
  render(<SyncChip project={kiboProject()} />);
  expect(screen.queryByText(/Hors connexion/)).toBeNull();
  setOnline(false);
  expect(screen.getByText("Hors connexion · reconnexion…")).toBeTruthy();
  setOnline(true);
  expect(screen.queryByText(/Hors connexion/)).toBeNull();
});

test("the daemon stopped on the home screen: the chip shows too", () => {
  online = false;
  render(<SyncChip project={null} />);
  expect(screen.getByText("Hors connexion · reconnexion…")).toBeTruthy();
});
