import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { ProjectSnapshot, RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { viewFixture } from "../project-agent/fixtures";
import { emisFeatureProject, NOW } from "./feature/fixture";
import { type Host, HostProvider } from "./Host";

const calls: RpcRequest[] = [];

const answer = (req: RpcRequest): unknown => {
  if (req.method === "listProjectEvents") return { items: [], nextBefore: null };
  if (req.method === "listCiRuns") return [];
  if (req.method === "getProjectAgent") return viewFixture({ batches: [] });
  return null;
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return answer(req);
      },
      subscribeTopic: () => () => {},
      subscribeIntegrations: () => () => {},
    },
  }),
);

const { FeatureDetail } = await import("./FeatureDetail");

const host: Host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};

beforeEach(() => {
  calls.length = 0;
});
afterEach(cleanup);

const renderFeature = (project: ProjectSnapshot) => {
  const feature = project.tickets.find((t) => t.id === "f5");
  if (!feature) throw new Error("fixture without F5");
  return render(
    <HostProvider host={host}>
      <FeatureDetail
        project={project}
        ticket={feature}
        now={NOW}
        execution="hidden"
        onOpenFile={() => undefined}
        onOpenTicket={() => undefined}
      />
    </HostProvider>,
  );
};

const commands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));

const patchTicket = (project: ProjectSnapshot, id: string, patch: object): ProjectSnapshot => ({
  ...project,
  tickets: project.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

function withF8(project: ProjectSnapshot): ProjectSnapshot {
  const f7 = project.tickets.find((t) => t.id === "f7");
  if (!f7) throw new Error("fixture without F7");
  const f8 = {
    ...f7,
    id: "f8",
    key: "EMIS-80",
    keyLabel: "EMIS-80",
    shortKey: "F8",
    title: "Valider les soudures",
  };
  return { ...project, tickets: [...project.tickets, f8] };
}

test("the feature is named once, by its F<n> key", () => {
  renderFeature(emisFeatureProject());
  expect(screen.getByText("Fonctionnalité · F5")).toBeTruthy();
  expect(screen.queryByText(/EMIS-30/)).toBeNull();
});

test("a feature keyed F5 is not named twice", () => {
  renderFeature(patchTicket(emisFeatureProject(), "f5", { key: "F5", keyLabel: "F5" }));
  expect(screen.getByText("Fonctionnalité · F5")).toBeTruthy();
});

test("step cards take their own height: nothing overlaps", () => {
  renderFeature(emisFeatureProject());
  const steps = within(screen.getByRole("list")).getAllByRole("listitem");
  for (const step of steps) {
    expect(step.className).not.toMatch(/(^|\s)h-\[/);
    expect(step.className).toMatch(/min-h-\[/);
  }
});

test("an optional step wears a « facultative » pill", () => {
  renderFeature(patchTicket(emisFeatureProject(), "e35", { optional: true }));
  const steps = within(screen.getByRole("list")).getAllByRole("listitem");
  expect(within(steps[4] as HTMLElement).getByText("facultative")).toBeTruthy();
  expect(within(steps[3] as HTMLElement).queryByText("facultative")).toBeNull();
});

test("+ Dépendance makes the feature wait for another one", async () => {
  renderFeature(withF8(emisFeatureProject()));
  const user = userEvent.setup();
  const deps = within(screen.getByRole("region", { name: "Dépendances" }));
  await user.click(deps.getByRole("button", { name: "Dépendance" }));
  const options = screen.getAllByRole("menuitem").map((m) => m.textContent);
  expect(options).toEqual(["F8Valider les soudures"]);
  await user.click(screen.getByRole("menuitem", { name: /F8/ }));
  expect(commands()).toEqual([{ method: "addLink", from: "f8", to: "f5", type: "blocks" }]);
});
