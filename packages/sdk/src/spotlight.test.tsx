import { expect, test } from "bun:test";
import type { ComponentManifestInput } from "@kibo/schema";
import { act, render, screen } from "@testing-library/react";
import { seedDemo } from "./fixtures";
import { createMockSdk } from "./mock";
import { SdkProvider, useSpotlight } from "./react";
import { createSpotlightStore, NO_SPOTLIGHT } from "./spotlight";

const MANIFEST: ComponentManifestInput = {
  id: "spot",
  version: "1.0.0",
  kind: "view",
  title: "Spot",
  description: "Lit la cible",
  reads: ["question"],
  writes: [],
};

function Probe() {
  const spotlight = useSpotlight();
  return (
    <output>
      {spotlight?.kind === "question" ? `${spotlight.kind}:${spotlight.id}` : (spotlight?.kind ?? "aucune")}
    </output>
  );
}

test("a spotlight store holds one target and tells its listeners", () => {
  const store = createSpotlightStore();
  let calls = 0;
  const off = store.subscribe(() => {
    calls += 1;
  });
  expect(store.get()).toBeNull();
  store.set({ kind: "question", id: "q1" });
  expect(store.get()).toEqual({ kind: "question", id: "q1" });
  off();
  store.set(null);
  expect(calls).toBe(1);
  expect(NO_SPOTLIGHT.get()).toBeNull();
});

test("useSpotlight reads the target of the host, null without one", () => {
  const plain = createMockSdk(MANIFEST, { seed: seedDemo });
  const { unmount } = render(
    <SdkProvider sdk={plain.sdk}>
      <Probe />
    </SdkProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("aucune");
  unmount();
  const m = createMockSdk(MANIFEST, { seed: seedDemo, spotlight: { kind: "question", id: "q1" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Probe />
    </SdkProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("question:q1");
  act(() => m.setSpotlight({ kind: "question", id: "q2" }));
  expect(screen.getByRole("status").textContent).toBe("question:q2");
});

test("openView may carry a question, the mock records it", () => {
  const m = createMockSdk(MANIFEST, { seed: seedDemo });
  m.sdk.openView("questions", { question: "q1" });
  m.sdk.openView("notes");
  expect(m.openedViews).toEqual(["questions", "notes"]);
  expect(m.viewRequests).toEqual([
    { componentId: "questions", question: "q1" },
    { componentId: "notes", question: null },
  ]);
});
