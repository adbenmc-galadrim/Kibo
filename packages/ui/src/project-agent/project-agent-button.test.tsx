import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { pendingBatch, viewFixture } from "./fixtures";

const calls: RpcRequest[] = [];
const THREE = pendingBatch().actions.slice(0, 3);
let served = pendingBatch({ id: "b1", actions: THREE });
const listeners: (() => void)[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(viewFixture({ batches: [served] }));
      },
      subscribeTopic: (_topic: string, listener: () => void) => {
        listeners.push(listener);
        return () => {};
      },
    },
  }),
);

const { ProjectAgentButton, signalCount } = await import("./ProjectAgentButton");

beforeEach(() => {
  calls.length = 0;
  listeners.length = 0;
  served = pendingBatch({ id: "b1", actions: THREE });
});

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

test("open signals show a numbered badge and are said in the label", async () => {
  show(agents(2, "b1"));
  await waitFor(() => expect(calls).toEqual([{ method: "getProjectAgent", projectId: "kibo" }]));
  expect(screen.getByRole("button", { name: "Agent de projet · 2 signaux en boîte" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ouvrir la boîte à signaux" }).textContent).toBe("2");
});

test("a pending batch without open signal shows the number of its actions", async () => {
  show(agents(0, "b1"));
  const main = await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  expect(main.textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")?.textContent).toBe("3");
  expect(screen.queryByRole("button", { name: "Ouvrir la boîte à signaux" })).toBeNull();
  expect(calls).toEqual([{ method: "getProjectAgent", projectId: "kibo" }]);
});

test("without a pending batch there is no count and nothing is fetched", async () => {
  show(agents(0));
  expect(screen.getByRole("button", { name: "Agent de projet" }).textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")).toBeNull();
  await waitFor(() => expect(calls).toEqual([]));
});

test("the count is hidden while the panel is open, the button keeps its text", async () => {
  render(
    <ProjectAgentButton
      projectId="kibo"
      agents={agents(0, "b1")}
      open
      onToggle={() => {}}
      onOpenSignals={() => {}}
    />,
  );
  const main = await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  expect(main.textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")).toBeNull();
});

test("a click on the badge opens the signals, elsewhere it toggles the panel", async () => {
  const calls = show(agents(1));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouvrir la boîte à signaux" }));
  await user.click(screen.getByRole("button", { name: "Agent de projet · 1 signal en boîte" }));
  expect(calls).toEqual(["signals", "toggle"]);
});

test("the count follows a partial decision of the pending batch", async () => {
  show(agents(0, "b1"));
  await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  const first = THREE[0];
  if (!first) throw new Error("no action");
  served = { ...served, chosen: [first.id] };
  for (const listener of listeners) listener();
  await screen.findByRole("button", { name: "Agent de projet · 2 actions à valider" });
  expect(document.querySelector("[data-pending]")?.textContent).toBe("2");
});
