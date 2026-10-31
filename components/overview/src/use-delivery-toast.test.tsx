import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DeliveryToasts } from "./DeliveryToast";
import { build } from "./model-test-kit";
import { type FeatureFacts, featureFacts } from "./overview-facts";
import { useDeliveryToast } from "./use-delivery-toast";

afterEach(cleanup);

const facts = () => {
  const { input } = build();
  return featureFacts(input.tickets, input.links);
};

const undelivered = (features: readonly FeatureFacts[], id: string): FeatureFacts[] =>
  features.map((f) => (f.id === id ? { ...f, state: { ...f.state, status: "open" as const } } : f));

function Probe({ features, ready = true }: { features: readonly FeatureFacts[]; ready?: boolean }) {
  const { toasts, close } = useDeliveryToast(features, ready);
  return <DeliveryToasts toasts={toasts} onClose={close} />;
}

test("a feature that becomes delivered after a project event toasts once ; the initial load toasts nothing", () => {
  const features = facts();
  const f3 = features.find((f) => f.shortKey === "F3");
  if (f3 === undefined) throw new Error("F3");
  const before = undelivered(features, f3.id);
  const view = render(<Probe features={[]} ready={false} />);
  view.rerender(<Probe features={before} />);
  expect(screen.queryByRole("status")).toBeNull();
  view.rerender(<Probe features={features} />);
  expect(screen.getByRole("status").textContent).toContain("F3Réaffecter un box· livrée4/4 étapes");
  view.rerender(<Probe features={before} />);
  view.rerender(<Probe features={features} />);
  expect(screen.getAllByRole("status").length).toBe(1);
  cleanup();
  const again = render(<Probe features={before} />);
  again.rerender(<Probe features={features} />);
  expect(screen.queryByRole("status")).toBeNull();
});

test("the toast closes by itself after 6 s, or on its close button", async () => {
  const features = facts();
  const f4 = { ...features[0], id: "other" } as FeatureFacts;
  const delivered = { ...f4, state: { ...f4.state, status: "delivered" as const } };
  const open = { ...f4, state: { ...f4.state, status: "open" as const } };
  const realSetTimeout = globalThis.setTimeout;
  const pending: (() => void)[] = [];
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    if (ms === 6000) pending.push(fn);
    return realSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    const view = render(<Probe features={[open]} />);
    view.rerender(<Probe features={[delivered]} />);
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => {
      for (const fn of pending) fn();
    });
    expect(screen.queryByRole("status")).toBeNull();
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});
