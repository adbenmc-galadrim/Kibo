import { expect, mock, test } from "bun:test";
import type { AgentsState } from "@kibo/schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "../i18n/fr";
import { AgentBar } from "./AgentBar";
import { agentsFixture, NOW } from "./fixtures";

const withStep = (): AgentsState => ({
  ...agentsFixture(),
  progress: [{ runId: "r43", step: { index: 2, total: 5, title: "Corriger la validation" }, report: null }],
});

const barText = () => "3/3 places · 4 en file · 1 attend une réponse";

function renderBar(state = agentsFixture(), expanded = false) {
  const onToggle = mock(() => {});
  const onSelect = mock((_: string) => {});
  const onLaunch = mock(() => {});
  render(
    <AgentBar
      state={state}
      now={NOW}
      online
      expanded={expanded}
      onToggle={onToggle}
      onSelect={onSelect}
      onLaunch={onLaunch}
    />,
  );
  return {
    onToggle,
    onSelect,
    onLaunch,
    bar: screen.getByRole("button", { name: expanded ? fr.agents.collapse : fr.agents.expand }),
  };
}

test("the whole bar is a button that opens the dock on click, Enter and Space", async () => {
  const { onToggle, bar } = renderBar();
  expect(bar.getAttribute("aria-expanded")).toBe("false");
  expect(bar.className).toContain("absolute inset-0");
  expect(screen.getByText(barText()).closest(".pointer-events-none")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(bar);
  bar.focus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(onToggle).toHaveBeenCalledTimes(3);
});

test("the inner buttons act on their own and never fold or unfold the dock", async () => {
  const { onToggle, onSelect } = renderBar();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Répondre à opus-dev-2" }));
  await user.click(screen.getByText("opus-dev-3"));
  expect(onSelect.mock.calls).toEqual([["r41"], ["r43"]]);
  const answer = screen.getByRole("button", { name: "Répondre à opus-dev-2" });
  fireEvent.keyDown(answer, { key: "Enter" });
  expect(onToggle).not.toHaveBeenCalled();
});

test("the bar sums up places, queue and the waiting run, and names the running runs", async () => {
  renderBar();
  expect(screen.getByText(barText())).toBeTruthy();
  expect(await screen.findByText("opus-dev-1")).toBeTruthy();
  expect(screen.getByText("Kibo · connecté")).toBeTruthy();
  for (const label of ["opus-dev-1", "opus-dev-3", "sonnet-review-1"])
    expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("KIB-12 · 12m")).toBeTruthy();
});

test("a run chip shows the current step of its plan when there is one", async () => {
  renderBar(withStep());
  expect(await screen.findByText("KIB-16 · 2/5 · Corriger la validation")).toBeTruthy();
  expect(screen.getByText("KIB-7 · 1m")).toBeTruthy();
});

test("the bar says when the daemon is out of reach", () => {
  render(
    <AgentBar
      state={agentsFixture()}
      now={NOW}
      online={false}
      expanded={false}
      onToggle={() => {}}
      onSelect={() => {}}
    />,
  );
  expect(screen.getByText("Kibo · hors ligne")).toBeTruthy();
});

test("unfolded, the bar keeps the summary, offers to launch an agent and folds back", async () => {
  const { onToggle, onLaunch, bar } = renderBar(agentsFixture(), true);
  expect(bar.getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByText("opus-dev-3")).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lancer un agent" }));
  expect(onLaunch).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
  await user.click(bar);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("the bar hides the runs that wrap behind a counter that opens the dock", async () => {
  const wrapped = new Set(["r43", "r44"]);
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      return wrapped.has(this.dataset.run ?? "") ? 16 : 0;
    },
  });
  try {
    const { onToggle } = renderBar();
    const counter = await screen.findByRole("button", { name: "2 autres runs en cours" });
    expect(counter.textContent).toBe("+2");
    const item = (label: string) => screen.getByText(label).closest("li");
    expect(item("opus-dev-1")?.getAttribute("aria-hidden")).toBeNull();
    for (const label of ["opus-dev-3", "sonnet-review-1"]) {
      expect(item(label)?.getAttribute("aria-hidden")).toBe("true");
      expect(item(label)?.querySelector("button")?.tabIndex).toBe(-1);
    }
    await userEvent.setup().click(counter);
    expect(onToggle).toHaveBeenCalledTimes(1);
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, "offsetTop", original);
  }
});

test("the counter speaks of a single run in the singular", () => {
  expect(fr.agents.moreRuns(1)).toBe("1 autre run en cours");
});

test("2026-10-14: open overlaps add nothing to the bar, folded or expanded", () => {
  const state = {
    ...agentsFixture(),
    overlaps: [
      { runId: "r43", open: 1 },
      { runId: "r42", open: 1 },
    ],
    overlapTotal: 1,
  };
  for (const expanded of [false, true]) {
    renderBar(state, expanded);
    expect(screen.getByText(barText())).toBeTruthy();
    expect(screen.queryByText(/recouvrement/)).toBeNull();
    expect(screen.queryByRole("img", { name: /recouvrement/ })).toBeNull();
    cleanup();
  }
});
