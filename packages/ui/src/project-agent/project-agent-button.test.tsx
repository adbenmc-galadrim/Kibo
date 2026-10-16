import { expect, test } from "bun:test";
import type { AgentsState } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture } from "../agents/fixtures";
import { ProjectAgentButton, signalCount } from "./ProjectAgentButton";

function agents(open: number, pendingBatchId: string | null = null): AgentsState {
  return {
    ...agentsFixture(),
    projectAgents: [{ projectId: "kibo", runId: "pa1", state: "done", pendingBatchId }],
    signals: [
      { projectId: "kibo", open, unread: open },
      { projectId: "emis", open: 7, unread: 0 },
    ],
  };
}

function show(state: AgentsState | null) {
  const calls: string[] = [];
  render(
    <ProjectAgentButton
      projectId="kibo"
      agents={state}
      open={false}
      onToggle={() => calls.push("toggle")}
      onOpenSignals={() => calls.push("signals")}
    />,
  );
  return calls;
}

test("signalCount reads the open signals of this project only", () => {
  expect(signalCount(agents(2), "kibo")).toBe(2);
  expect(signalCount(agents(2), "other")).toBe(0);
  expect(signalCount(null, "kibo")).toBe(0);
});

test("open signals show a numbered badge and are said in the label", () => {
  show(agents(2, "b1"));
  expect(screen.getByRole("button", { name: "Agent de projet · 2 signaux en boîte" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ouvrir la boîte à signaux" }).textContent).toBe("2");
});

test("a pending batch without open signal keeps the plain dot", () => {
  const { container } = render(
    <ProjectAgentButton
      projectId="kibo"
      agents={agents(0, "b1")}
      open={false}
      onToggle={() => {}}
      onOpenSignals={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Agent de projet · Un lot attend ta validation" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ouvrir la boîte à signaux" })).toBeNull();
  expect(container.querySelector("span.size-2.rounded-full")).toBeTruthy();
});

test("a click on the badge opens the signals, elsewhere it toggles the panel", async () => {
  const calls = show(agents(1));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouvrir la boîte à signaux" }));
  await user.click(screen.getByRole("button", { name: "Agent de projet · 1 signal en boîte" }));
  expect(calls).toEqual(["signals", "toggle"]);
});
