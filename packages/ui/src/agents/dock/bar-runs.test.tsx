import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { OTHER_RUN, OWNER_RUN, overlapAgents } from "../../overlaps/fixtures";
import { agentsFixture, NOW } from "../fixtures";
import { BarRuns } from "./BarRuns";
import { DockRuns } from "./DockRuns";
import { dockGroups } from "./dock-runs";

const renderBar = (open: number) =>
  render(<BarRuns state={overlapAgents(open)} now={NOW} onSelect={() => {}} onMore={() => {}} />);

const row = (runId: string): HTMLElement => {
  const li = document.querySelector(`[data-run="${runId}"]`);
  if (!(li instanceof HTMLElement)) throw new Error(`no row ${runId}`);
  return li;
};

test("2026-10-14: a run with open overlaps carries no chip in the bar", () => {
  renderBar(2);
  for (const runId of [OWNER_RUN, OTHER_RUN]) {
    expect(within(row(runId)).queryByRole("img", { name: /recouvrement/ })).toBeNull();
    expect(row(runId).querySelector("svg.lucide-copy")).toBeNull();
  }
});

const groups = () => {
  const state = overlapAgents(1);
  return dockGroups(state, NOW);
};

test("2026-10-14: even with open overlaps, the dock rows carry no overlap sub-list", () => {
  render(
    <DockRuns
      groups={groups()}
      progress={[]}
      delivery={[]}
      questions={[]}
      now={NOW}
      selected={null}
      onSelect={() => {}}
    />,
  );
  expect(screen.queryByText(/^Recouvrement avec/)).toBeNull();
  expect(document.querySelector("svg.lucide-copy")).toBeNull();
});

const PLAN = { runId: "r44", step: { index: 2, total: 5, title: "Corriger la validation" }, report: null };
const STEP = { runId: "r44", step: 7, note: "gates verts" };

test("the bar shows the delivery step of a run instead of its plan step", () => {
  const state = { ...agentsFixture(), progress: [PLAN], delivery: [STEP] };
  render(<BarRuns state={state} now={NOW} onSelect={() => {}} onMore={() => {}} />);
  expect(row("r44").textContent).toContain("7 · Porte qualité");
  expect(row("r44").textContent).not.toContain("2/5");
});

test("without a delivery step the bar keeps the plan step", () => {
  const state = { ...agentsFixture(), progress: [PLAN] };
  render(<BarRuns state={state} now={NOW} onSelect={() => {}} onMore={() => {}} />);
  expect(row("r44").textContent).toContain("2/5 · Corriger la validation");
});

test("the dock shows the delivery step, then the plan step", () => {
  const state = agentsFixture();
  render(
    <DockRuns
      groups={dockGroups(state, NOW)}
      progress={[PLAN]}
      delivery={[STEP]}
      questions={[]}
      now={NOW}
      selected={null}
      onSelect={() => {}}
    />,
  );
  const line = screen.getByText(/7 · Porte qualité/);
  expect(line.textContent).toBe("7 · Porte qualité · 2/5 · Corriger la validation");
});
