import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OPEN_OVERLAP, OTHER_RUN, OWNER_RUN, overlapAgents } from "../../overlaps/fixtures";
import { overlapLinesByRun } from "../../overlaps/overlap-labels";
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

test("screen 200: a run with an open overlap carries a chip after its label", () => {
  renderBar(1);
  for (const runId of [OWNER_RUN, OTHER_RUN]) {
    const chip = within(row(runId)).getByRole("img", { name: "1 recouvrement ouvert" });
    expect(chip.textContent).toBe("1");
    expect(chip.querySelector("svg.lucide-copy")).toBeTruthy();
  }
});

test("without an open overlap there is no chip", () => {
  renderBar(0);
  expect(screen.queryByRole("img", { name: /recouvrement/ })).toBeNull();
});

const groups = () => {
  const state = overlapAgents(1);
  return dockGroups(state, NOW);
};

test("screen 200: under the current step, an open overlap names the other ticket and goes to it", async () => {
  const selected: string[] = [];
  const focused: [string, string][] = [];
  render(
    <DockRuns
      groups={groups()}
      progress={[]}
      questions={[]}
      now={NOW}
      selected={null}
      onSelect={(id) => selected.push(id)}
      overlapLines={overlapLinesByRun([OPEN_OVERLAP], overlapAgents(1).runs)}
      onOverlap={(runId, overlapId) => focused.push([runId, overlapId])}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Recouvrement avec BOU-12" }));
  expect(focused).toEqual([[OTHER_RUN, "o1"]]);
  expect(selected).toEqual([]);
  expect(screen.getByRole("button", { name: "Recouvrement avec BOU-15" })).toBeTruthy();
});

test("without open overlaps the dock rows stay as they were", () => {
  render(
    <DockRuns groups={groups()} progress={[]} questions={[]} now={NOW} selected={null} onSelect={() => {}} />,
  );
  expect(screen.queryByRole("button", { name: /^Recouvrement avec/ })).toBeNull();
});
