import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { ProjectSnapshot, RpcRequest, Spotlight } from "@kibo/schema";
import type { NewTicketDefaults } from "@kibo/sdk";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { viewFixture } from "../project-agent/fixtures";
import { NOW, siloHeldProject } from "./feature/fixture";
import { type Host, HostProvider } from "./Host";

const calls: RpcRequest[] = [];

const answer = (req: RpcRequest): unknown => {
  if (req.method === "listProjectEvents") return { items: [], nextBefore: null };
  if (req.method === "listCiRuns") return [];
  if (req.method === "getProjectAgent") return viewFixture({ batches: [] });
  if (req.method === "getAppInfo") return { today: "2026-10-16" };
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

const created: NewTicketDefaults[] = [];
const views: (Spotlight | undefined)[] = [];
const host: Host = {
  openTicket: () => undefined,
  openNewTicket: (d) => void created.push(d),
  openFile: () => undefined,
  openView: (_id, _project, question) => void views.push(question),
  openTarget: () => undefined,
};

beforeEach(() => {
  calls.length = 0;
  created.length = 0;
  views.length = 0;
});
afterEach(cleanup);

const renderFeature = (featureId: string, project: ProjectSnapshot = siloHeldProject()) => {
  const feature = project.tickets.find((t) => t.id === featureId);
  if (!feature) throw new Error(`fixture without ${featureId}`);
  return render(
    <HostProvider host={host}>
      <FeatureDetail
        project={project}
        ticket={feature}
        now={NOW}
        onOpenFile={() => undefined}
        onOpenTicket={() => undefined}
      />
    </HostProvider>,
  );
};

test("a feature delivered without its step on hold says so in its badge and its bar", async () => {
  renderFeature("f4");
  expect(await screen.findByText("livrée · 1 en attente")).toBeTruthy();
  expect(screen.getByText("3 étapes livrées sur 3 · 1 en attente")).toBeTruthy();
  const bar = screen.getByRole("img", { name: "Étapes de la fonctionnalité" });
  expect(Array.from(bar.children, (c) => c.getAttribute("data-tone"))).toEqual([
    "done",
    "done",
    "done",
    "hold",
  ]);
  expect(screen.getByRole("region", { name: "En attente · 1" })).toBeTruthy();
});

test("the steps bar keeps the held steps at their place, in cyan, and still says « · 3 en attente »", async () => {
  renderFeature("f5");
  expect(await screen.findByText("1 étape livrée sur 2 · 3 en attente")).toBeTruthy();
  const bar = screen.getByRole("img", { name: "Étapes de la fonctionnalité" });
  const segments = Array.from(bar.children);
  expect(segments.map((c) => c.getAttribute("data-tone"))).toEqual([
    "done",
    "review",
    "hold",
    "hold",
    "hold",
  ]);
  expect(segments[2]?.className).toContain("bg-(--tracking-hold)");
});

test("the journey of F5 numbers its active steps and leaves the steps on hold below", async () => {
  renderFeature("f5");
  expect(await screen.findByText("1 étape livrée sur 2 · 3 en attente")).toBeTruthy();
  const journey = screen.getAllByRole("list")[0] as HTMLElement;
  expect(
    within(journey)
      .getAllByTestId("step-marker")
      .map((m) => m.textContent),
  ).toEqual(["", "2"]);
  expect(screen.queryByRole("button", { name: "Copier la commande" })).toBeNull();
  expect(screen.queryByText(/ne tiendra pas/)).toBeNull();
  const held = screen.getByRole("region", { name: "En attente · 3" });
  expect(within(held).getAllByRole("listitem")).toHaveLength(3);
});

test("the step proposed to copy is an active one, never a step on hold", async () => {
  const user = userEvent.setup();
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  const base = siloHeldProject();
  const startable = new Set(["e32", "e34"]);
  renderFeature("f5", {
    ...base,
    tickets: base.tickets.map((t) =>
      startable.has(t.id) ? { ...t, statusId: "todo" as const, startable: true, startReason: null } : t,
    ),
  });
  await user.click(await screen.findByRole("button", { name: "Copier la commande" }));
  expect(written).toEqual(["/full-delivery SILO-32"]);
});
