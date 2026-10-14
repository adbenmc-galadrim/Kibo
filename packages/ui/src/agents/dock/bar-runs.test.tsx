import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { OTHER_RUN, OWNER_RUN, overlapAgents } from "../../overlaps/fixtures";
import { NOW } from "../fixtures";
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
    <DockRuns groups={groups()} progress={[]} questions={[]} now={NOW} selected={null} onSelect={() => {}} />,
  );
  expect(screen.queryByText(/^Recouvrement avec/)).toBeNull();
  expect(document.querySelector("svg.lucide-copy")).toBeNull();
});
