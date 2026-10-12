import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { NOW, runFixture } from "./fixtures";
import { formatClock } from "./format";
import { RunHistory } from "./RunHistory";

const run = (id: string, seq: number, startedAt: number) =>
  runFixture({ id, seq, label: "global · review-pr · KIB-3", ticketKey: "KIB-3", startedAt, state: "done" });

test("the agent column names each run, two runs of the same agent differ by their start time", () => {
  const early = NOW - 3_600_000;
  const late = NOW - 600_000;
  render(
    <RunHistory
      runs={[run("b", 2, late), run("a", 1, early)]}
      questions={[]}
      positions={new Map()}
      projectColumn={null}
      now={NOW}
      onOpenRun={() => {}}
    />,
  );
  expect(screen.getByRole("columnheader", { name: "Agent" })).toBeTruthy();
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows.map((r) => within(r).getAllByRole("cell")[2]?.textContent)).toEqual([
    `global · review-pr · KIB-3${formatClock(late)}`,
    `global · review-pr · KIB-3${formatClock(early)}`,
  ]);
});
