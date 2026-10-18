import { expect, test } from "bun:test";
import type { RunPeek } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const PEEK: RunPeek = {
  runId: "r1",
  label: "opus-dev-2",
  profileName: "opus-dev",
  state: "waiting_input",
  ticketKey: "KIB-4",
  ticketTitle: "Récepteur",
  step: { index: 2, total: 5, title: "Corriger la validation" },
  lastMessage: "Quel format de date ?",
  waiting: true,
};

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", peeks: { r1: PEEK }, agentExecution: "shown" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const queueKib5 = (m: ReturnType<typeof setup>) => {
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-5")?.id ?? "";
  act(() => m.setRuns([{ ticketId: id, runId: "r5", label: "opus-dev", state: "queued", position: 1 }]));
};

const card = async (key: string) => {
  const found = (await screen.findByText(key)).closest("article");
  if (!(found instanceof HTMLElement)) throw new Error(`no card ${key}`);
  return found;
};

test("screen 188k: no card carries a 'Démarrable' badge, the filter keeps the startable ones", async () => {
  const m = setup();
  queueKib5(m);
  await card("KIB-1");
  for (const article of screen.getAllByRole("article"))
    expect(within(article).queryByText("Démarrable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Démarrable" }));
  expect(await card("KIB-1")).toBeTruthy();
  expect(screen.queryByText("KIB-5")).toBeNull();
  expect(screen.queryByText("KIB-2")).toBeNull();
  expect(screen.queryByText("KIB-4")).toBeNull();
  act(() => m.setRuns([]));
  expect(await card("KIB-5")).toBeTruthy();
});

test("a live run on a card is an agent mention: hover peeks the run, click opens it", async () => {
  const m = setup();
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-4")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "waiting_input", position: null }]),
  );
  const mention = await within(await card("KIB-4")).findByRole("button", { name: "opus-dev-2" });
  const badge = mention.closest("[data-slot=badge]");
  expect(badge?.textContent).toBe("opus-dev-2· Attend");
  expect(badge?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
  fireEvent.pointerEnter(mention);
  expect(await screen.findByText("2/5 · Corriger la validation")).toBeTruthy();
  expect(screen.getByText("Quel format de date ?")).toBeTruthy();
  expect(m.used).toContain("read:run");
  fireEvent.click(mention);
  expect(m.openedRuns).toEqual(["r1"]);
});

test("without a live run, the assigned agent stays a plain badge", async () => {
  setup();
  const kib5 = await card("KIB-5");
  expect(within(kib5).getByText("opus-dev")).toBeTruthy();
  expect(within(kib5).queryByRole("button", { name: "opus-dev" })).toBeNull();
});
