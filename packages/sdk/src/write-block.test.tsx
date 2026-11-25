import { expect, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import { act, render, screen } from "@testing-library/react";
import { createMockSdk } from "./mock";
import { SdkProvider, useWriteBlock } from "./react";
import { createSdk } from "./sdk";
import { createSignal, writesApi } from "./signal";
import type { ProjectBackend, SdkContext } from "./types";

const base = {
  id: "probe",
  version: "0.1.0",
  kind: "widget" as const,
  title: "Probe",
  reads: [],
  writes: [],
};
const manifest = ComponentManifest.parse(base);

function Probe() {
  const block = useWriteBlock();
  return <p>{block ?? "writable"}</p>;
}

const backend: ProjectBackend = {
  snapshot: () => Promise.reject(new Error("unused")),
  run: () => Promise.reject(new Error("unused")),
  call: () => Promise.reject(new Error("unused")),
  subscribe: () => () => undefined,
};

const ctx: SdkContext = {
  instanceId: "i",
  config: {},
  viewer: "adam",
  surface: "view",
  format: "full",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};

test("writes are allowed by default, on the desktop and in the mock", () => {
  expect(createSdk(backend, manifest, ctx).writes.blocked()).toBeNull();
  expect(createMockSdk(base).sdk.writes.blocked()).toBeNull();
});

test("the host lends its write block to the sdk", () => {
  const reason = createSignal<string | null>("Mac éteint");
  const sdk = createSdk(backend, manifest, { ...ctx, writes: writesApi(reason) });
  expect(sdk.writes.blocked()).toBe("Mac éteint");
  reason.set(null);
  expect(sdk.writes.blocked()).toBeNull();
});

test("useWriteBlock follows the block and reads as writable without an sdk", () => {
  const m = createMockSdk(base, { writeBlock: "Hors connexion" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Probe />
    </SdkProvider>,
  );
  expect(screen.getByText("Hors connexion")).toBeTruthy();
  act(() => m.setWriteBlock(null));
  expect(screen.getByText("writable")).toBeTruthy();
  act(() => m.setWriteBlock("Mac éteint"));
  expect(screen.getByText("Mac éteint")).toBeTruthy();
});

test("useWriteBlock is writable outside a provider", () => {
  render(<Probe />);
  expect(screen.getByText("writable")).toBeTruthy();
});
