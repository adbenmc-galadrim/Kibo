import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture } from "../lib/fixtures";
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

const { ProjectAgentButton } = await import("./ProjectAgentButton");

beforeEach(() => {
  calls.length = 0;
  listeners.length = 0;
  served = pendingBatch({ id: "b1", actions: THREE });
});

function agents(pendingBatchId: string | null = null): AgentsState {
  return {
    ...agentsFixture(),
    projectAgents: [
      { projectId: "kibo", runId: "pa1", state: "done", pendingBatchId },
      { projectId: "silo", runId: "pa2", state: "done", pendingBatchId: "b9" },
    ],
  };
}

function show(state: AgentsState | null) {
  const calls: string[] = [];
  render(
    <ProjectAgentButton projectId="kibo" agents={state} open={false} onToggle={() => calls.push("toggle")} />,
  );
  return calls;
}

test("a pending batch shows the number of its actions", async () => {
  show(agents("b1"));
  const main = await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  expect(main.textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")?.textContent).toBe("3");
  expect(calls).toEqual([{ method: "getProjectAgent", projectId: "kibo" }]);
});

test("without a pending batch there is no count and nothing is fetched", async () => {
  show(agents());
  expect(screen.getByRole("button", { name: "Agent de projet" }).textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")).toBeNull();
  await waitFor(() => expect(calls).toEqual([]));
});

test("the count is hidden while the panel is open, the button keeps its text", async () => {
  render(<ProjectAgentButton projectId="kibo" agents={agents("b1")} open onToggle={() => {}} />);
  const main = await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  expect(main.textContent).toBe("Agent de projet");
  expect(document.querySelector("[data-pending]")).toBeNull();
});

test("a click on the button toggles the panel", async () => {
  const calls = show(agents());
  await userEvent.setup().click(screen.getByRole("button", { name: "Agent de projet" }));
  expect(calls).toEqual(["toggle"]);
});

test("the count follows a partial decision of the pending batch", async () => {
  show(agents("b1"));
  await screen.findByRole("button", { name: "Agent de projet · 3 actions à valider" });
  const first = THREE[0];
  if (!first) throw new Error("no action");
  served = { ...served, chosen: [first.id] };
  for (const listener of listeners) listener();
  await screen.findByRole("button", { name: "Agent de projet · 2 actions à valider" });
  expect(document.querySelector("[data-pending]")?.textContent).toBe("2");
});
