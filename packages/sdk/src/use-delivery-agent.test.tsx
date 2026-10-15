import { afterEach, expect, test } from "bun:test";
import { type ComponentCall, ComponentManifest } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createMockSdk } from "./mock";
import { SdkProvider } from "./react";
import { createSdk } from "./sdk";
import type { KiboSdk, ProjectBackend } from "./types";
import { useDeliveryAgentKnown } from "./use-delivery-agent";

afterEach(cleanup);

const manifest = ComponentManifest.parse({
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket", "run"],
  writes: ["ticket", "run"],
});

function Probe() {
  return <p>{useDeliveryAgentKnown() ? "connu" : "absent"}</p>;
}

const show = (sdk: KiboSdk, copies: readonly string[] = ["a"]) =>
  render(
    <SdkProvider sdk={sdk}>
      {copies.map((id) => (
        <Probe key={id} />
      ))}
    </SdkProvider>,
  );

const backend = (answer: () => Promise<unknown>, calls: ComponentCall[]): ProjectBackend => ({
  snapshot: async () => {
    throw new Error("unused");
  },
  run: async () => null,
  call: (c) => {
    calls.push(c);
    return answer();
  },
  subscribe: () => () => undefined,
  runs: async () => [],
  subscribeRuns: () => () => undefined,
});

const ctx = {
  instanceId: "i",
  config: {},
  viewer: "adam",
  surface: "view" as const,
  format: "medium" as const,
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};

test("a known delivery agent turns the answer to known", async () => {
  show(createMockSdk(manifest).sdk);
  expect(screen.getByText("absent")).toBeTruthy();
  expect(await screen.findByText("connu")).toBeTruthy();
});

test("no delivery agent, or a failure, keeps Livrer away", async () => {
  show(createMockSdk(manifest, { deliveryAgent: null }).sdk);
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.getByText("absent")).toBeTruthy();
  cleanup();
  const calls: ComponentCall[] = [];
  show(
    createSdk(
      backend(() => Promise.reject(new Error("down")), calls),
      manifest,
      ctx,
    ),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.getByText("absent")).toBeTruthy();
});

test("the answer is read once per sdk", async () => {
  const calls: ComponentCall[] = [];
  const answer = () => Promise.resolve({ ref: "global:full-delivery", name: "full-delivery" });
  show(createSdk(backend(answer, calls), manifest, ctx), ["a", "b", "c"]);
  expect(await screen.findAllByText("connu")).toHaveLength(3);
  expect(calls).toEqual([{ kind: "run.deliveryAgent" }]);
});
