import { expect, mock, test } from "bun:test";
import type { AgentsState, RunSubagentSummary } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { activeSummary, CONVENTIONS, CORRECTNESS } from "../../moments/subagent-fixtures";
import { agentsFixture, NOW } from "../fixtures";
import { BarRuns } from "./BarRuns";
import { DockRuns } from "./DockRuns";
import { dockGroups } from "./dock-runs";

const RUN = "r42";

const running = (s: typeof CORRECTNESS): RunSubagentSummary => ({
  ...activeSummary(s, RUN),
  state: "running",
  startedAt: NOW - 2 * 60_000,
});

const withSubagents = (subagents: RunSubagentSummary[]): AgentsState => ({ ...agentsFixture(), subagents });

const row = (runId: string): HTMLElement => {
  const li = document.querySelector(`[data-run="${runId}"]`);
  if (!(li instanceof HTMLElement)) throw new Error(`no row ${runId}`);
  return li;
};

test("screen 218: each active sub-agent is one compact line under its run, and opens it", async () => {
  const onSubagent = mock((_runId: string, _id: string) => {});
  render(
    <BarRuns
      state={withSubagents([running(CORRECTNESS), running(CONVENTIONS)])}
      now={NOW}
      onSelect={() => {}}
      onSubagent={onSubagent}
      onMore={() => {}}
    />,
  );
  const lines = within(row(RUN)).getAllByRole("button", { name: /^Voir le sous-agent/ });
  expect(lines).toHaveLength(2);
  const [first] = lines;
  if (!first) throw new Error("no line");
  expect(first.textContent).toBe("↳ecc:code-reviewer· Porte qualité — correctness · 2 min");
  expect(within(first).getByText("ecc:code-reviewer").className).toContain("text-brand");
  expect(row(RUN).querySelectorAll("ul")).toHaveLength(1);
  await userEvent.setup().click(first);
  expect(onSubagent).toHaveBeenCalledWith(RUN, CORRECTNESS.id);
});

test("a run without an active sub-agent carries no line at all", () => {
  render(<BarRuns state={withSubagents([])} now={NOW} onSelect={() => {}} onMore={() => {}} />);
  expect(screen.queryByRole("button", { name: /^Voir le sous-agent/ })).toBeNull();
  expect(row(RUN).querySelector("ul")).toBeNull();
});

test("the dock lists the same lines under the active run", async () => {
  const onSubagent = mock((_runId: string, _id: string) => {});
  const state = withSubagents([running(CORRECTNESS)]);
  render(
    <DockRuns
      groups={dockGroups(state, NOW)}
      progress={[]}
      delivery={[]}
      questions={[]}
      subagents={state.subagents ?? []}
      now={NOW}
      selected={null}
      onSelect={() => {}}
      onSubagent={onSubagent}
    />,
  );
  await userEvent.setup().click(
    screen.getByRole("button", {
      name: "Voir le sous-agent ecc:code-reviewer · Porte qualité — correctness dans le fil",
    }),
  );
  expect(onSubagent).toHaveBeenCalledWith(RUN, CORRECTNESS.id);
});
