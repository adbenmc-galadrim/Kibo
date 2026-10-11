import { expect, test } from "bun:test";
import type { ProjectCommand, RunPeek, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const a = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  const b = run({ method: "createTicket", title: "Sync" }) as Ticket;
  run({ method: "addLink", from: a.id, to: b.id, type: "blocks" });
  run({
    method: "createTicket",
    title: "Récepteur",
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "opus-dev" },
  });
};

const PEEK: RunPeek = {
  runId: "r1",
  label: "opus-dev-2",
  profileName: "opus-dev",
  state: "running",
  ticketKey: "KIB-3",
  ticketTitle: "Récepteur",
  step: { index: 1, total: 3, title: "Lire les hooks" },
  lastMessage: null,
  waiting: false,
};

const setup = () => {
  const m = createMockSdk(manifest, { seed, peeks: { r1: PEEK } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const row = async (key: string) => {
  const found = (await screen.findByText(key)).closest("li");
  if (!(found instanceof HTMLElement)) throw new Error(`no row ${key}`);
  return found;
};

test("a startable row shows a neutral 'Démarrable' badge, hidden below @md like the questions badge", async () => {
  setup();
  const badge = within(await row("KIB-1")).getByText("Démarrable");
  expect(badge.getAttribute("data-slot")).toBe("badge");
  expect(badge.getAttribute("data-variant")).toBe("outline");
  expect(badge.classList.contains("hidden")).toBe(true);
  expect(badge.classList.contains("@md:inline-flex")).toBe(true);
  expect(badge.className).toContain("zinc");
  expect(badge.className).not.toContain("orange");
  expect(within(await row("KIB-2")).queryByText("Démarrable")).toBeNull();
  expect(within(await row("KIB-3")).queryByText("Démarrable")).toBeNull();
});

test("the 'Démarrables' toggle sits after the labels menu, narrows the tree and is cleared with the rest", async () => {
  setup();
  const user = userEvent.setup();
  const toggle = await screen.findByRole("button", { name: "Démarrables" });
  const labels = screen.getByRole("button", { name: "Étiquettes" });
  expect(labels.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await user.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("KIB-1")).toBeTruthy();
  expect(screen.queryByText("KIB-2")).toBeNull();
  expect(screen.queryByText("KIB-3")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Effacer" }));
  expect(await screen.findByText("KIB-3")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Démarrables" }).getAttribute("aria-pressed")).toBe("false");
});

test("a live run in a row is an agent mention: hover peeks, click opens the run", async () => {
  const m = setup();
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-3")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "running", position: null }]),
  );
  const mention = await within(await row("KIB-3")).findByRole("button", { name: "opus-dev-2" });
  fireEvent.pointerEnter(mention);
  expect(await screen.findByText("1/3 · Lire les hooks")).toBeTruthy();
  expect(m.used).toContain("read:run");
  fireEvent.click(mention);
  expect(m.openedRuns).toEqual(["r1"]);
});
