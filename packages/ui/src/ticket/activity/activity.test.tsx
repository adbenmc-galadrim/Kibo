import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  type AgentsState,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type RpcRequest,
  type RunMomentsPage,
  type RunView,
} from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { NOW, runFixture } from "../../agents/fixtures";
import { apiMock } from "../../api-mock";
import { dockState, FEED_RUN, MOMENTS_PAGE, progressProject, REPORTED_RUN } from "../../moments/fixtures";
import { reviewFixture } from "../../skills/fixtures";

const calls: RpcRequest[] = [];
const moments = { on: 0, off: 0 };
const page: RunMomentsPage = MOMENTS_PAGE;

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
        if (req.method === "getPresence") return [];
        if (req.method === "runMoments") return req.runId === FEED_RUN ? page : { ...page, moments: [] };
        if (req.method === "skillReviews.list") return [reviewFixture({ runId: req.runId ?? "" })];
        return null;
      },
      code: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeCode: () => () => undefined,
      subscribeEvents: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
      subscribeMoments: () => {
        moments.on += 1;
        return () => {
          moments.off += 1;
        };
      },
    },
  }),
);

const { TicketSheet } = await import("../../shell/TicketSheet");
const { TicketTab } = await import("../../pages/TicketTab");
const { AgentsProvider } = await import("../../state/agents-context");

let width = 1_200;
const observers = new Set<() => void>();
const originalObserver = globalThis.ResizeObserver;
const originalRect = HTMLElement.prototype.getBoundingClientRect;
const originalScroll = HTMLElement.prototype.scrollIntoView;

class FakeObserver implements ResizeObserver {
  private readonly notify: () => void;
  constructor(callback: ResizeObserverCallback) {
    this.notify = () => callback([], this);
    observers.add(this.notify);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    observers.delete(this.notify);
  }
}

const resizeTo = (next: number) => {
  width = next;
  for (const notify of observers) notify();
};

beforeEach(() => {
  calls.length = 0;
  moments.on = 0;
  moments.off = 0;
  width = 1_200;
  window.sessionStorage.clear();
  globalThis.ResizeObserver = FakeObserver;
  HTMLElement.prototype.getBoundingClientRect = function rect() {
    return { width, height: 600, top: 0, left: 0, right: width, bottom: 600, x: 0, y: 0, toJSON: () => ({}) };
  };
});

afterEach(() => {
  globalThis.ResizeObserver = originalObserver;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  HTMLElement.prototype.scrollIntoView = originalScroll;
});

const show = (node: ReactNode, agents: AgentsState = dockState()) =>
  render(<AgentsProvider agents={agents}>{node}</AgentsProvider>);

const sheet = (project: ProjectSnapshot = progressProject(), agents?: AgentsState) =>
  show(
    <TicketSheet
      project={project}
      ticketId="t14"
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
      onDeleted={() => {}}
    />,
    agents,
  );

const openActivity = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Activité" }));
  await user.click(await screen.findByRole("button", { name: /^Ancien/ }));
  return screen.findByRole("tabpanel", { name: "Activité" });
};

test("the sheet opens on Détails and offers Activité", () => {
  sheet();
  expect(screen.getByRole("tab", { name: "Détails" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "Activité" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByText("Statut")).toBeTruthy();
});

test("Activité leads with the report of the last run", async () => {
  sheet();
  const panel = await openActivity();
  const report = await within(panel).findByRole("region", { name: "Compte rendu" });
  for (const text of ["Fait", "Décisions", "À vérifier (2)", "Suite"]) {
    expect(within(report).getByText(text)).toBeTruthy();
  }
  expect(within(report).getByText("1 fichier modifié non mentionné")).toBeTruthy();
  expect(within(report).getByText("1 fichier cité sans modification")).toBeTruthy();
});

test("screen 196: the skill reviews of the last run sit under the report", async () => {
  sheet();
  const panel = await openActivity();
  const block = await within(panel).findByRole("region", { name: "Reviews de skills" });
  expect(within(block).getByRole("button", { name: "porte-qualite" })).toBeTruthy();
  const asked = calls.flatMap((c) => (c.method === "skillReviews.list" && c.runId ? [c.runId] : []));
  expect(asked.length).toBeGreaterThan(0);
  const report = within(panel).getByRole("region", { name: "Compte rendu" });
  expect(report.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("without a report, the tab says so", async () => {
  const project = progressProject();
  const bare = {
    ...project,
    tickets: project.tickets.map((t) => (t.id === "t14" ? { ...t, agentProgress: EMPTY_PROGRESS } : t)),
  };
  sheet(bare);
  const panel = await openActivity();
  expect((await within(panel).findAllByText("Pas de compte rendu pour ce run")).length).toBeGreaterThan(0);
});

test("a wide sheet shows one chronology with the plan in a column", async () => {
  sheet();
  const panel = await openActivity();
  const chronology = await within(panel).findByRole("region", { name: "Chronologie" });
  const plan = within(panel).getByRole("region", { name: "Plan" });
  expect(
    await within(chronology).findByText("Je relis le récepteur et ses tests avant de toucher au port."),
  ).toBeTruthy();
  expect(within(plan).getByText("Corriger la validation du corps")).toBeTruthy();
  expect(plan.closest('[data-slot="scroll-pane"]')).not.toBeNull();
  expect(chronology.closest('[data-slot="scroll-pane"]')).toBeNull();
  expect(
    within(chronology).queryByText("Le corps vide passe parce que le test ne couvre que null."),
  ).toBeNull();
});

test("a plan step highlights its moments in the chronology", async () => {
  const scrolled: string[] = [];
  HTMLElement.prototype.scrollIntoView = function scroll(this: HTMLElement) {
    scrolled.push(this.dataset.step ?? "");
  };
  sheet();
  const panel = await openActivity();
  const chronology = await within(panel).findByRole("region", { name: "Chronologie" });
  await within(chronology).findByText("Je relis le récepteur et ses tests avant de toucher au port.");
  const plan = within(panel).getByRole("region", { name: "Plan" });
  await userEvent
    .setup()
    .click(within(plan).getByRole("button", { name: /Corriger la validation du corps/ }));
  expect(chronology.querySelectorAll("[data-step-current]").length).toBeGreaterThan(0);
  expect(scrolled).toEqual(["s2"]);
});

test("a narrow sheet stacks the plan, then the runs, the latest one open", async () => {
  width = 900;
  sheet();
  const panel = await openActivity();
  await within(panel).findByText("Chronologie des runs");
  expect(within(panel).queryByRole("region", { name: "Chronologie" })).toBeNull();
  const runs = within(panel).getAllByRole("button", { name: /^Run \d/ });
  expect(runs.map((r) => r.getAttribute("aria-expanded"))).toEqual(["true", "false"]);
  expect(runs[0]?.textContent).toContain("Run 2");
  const planStep = within(panel).getByText("Corriger la validation du corps");
  expect(planStep.compareDocumentPosition(runs[0] as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(
    await within(panel).findByText("Je relis le récepteur et ses tests avant de toucher au port."),
  ).toBeTruthy();
  expect(within(panel).getByText(/Fait, 2 points à vérifier/)).toBeTruthy();
});

test("the layout follows the width of the sheet", async () => {
  width = 900;
  sheet();
  const panel = await openActivity();
  await within(panel).findByText("Chronologie des runs");
  act(() => resizeTo(1_200));
  expect(await within(panel).findByRole("region", { name: "Chronologie" })).toBeTruthy();
});

test("only the ten latest runs are loaded until older ones are asked for", async () => {
  const runs: RunView[] = Array.from({ length: 12 }, (_, i) =>
    runFixture({
      id: `old-${i}`,
      ticketId: "t14",
      label: `opus-dev-${i}`,
      state: "done",
      startedAt: NOW - (100 - i) * 60_000,
      endedAt: NOW - (99 - i) * 60_000,
    }),
  );
  sheet(progressProject(), { ...dockState(), runs });
  const panel = await openActivity();
  const older = await within(panel).findByRole("button", { name: "Charger les runs plus anciens" });
  const loaded = () => new Set(calls.flatMap((c) => (c.method === "runMoments" ? [c.runId] : [])));
  await waitFor(() => expect(loaded().size).toBe(10));
  expect(loaded().has("old-0")).toBe(false);
  await userEvent.setup().click(older);
  await waitFor(() => expect(loaded().size).toBe(12));
  expect(calls.filter((c) => c.method === "runMoments")).toHaveLength(12);
  expect(within(panel).queryByRole("button", { name: "Charger les runs plus anciens" })).toBeNull();
});

test("the ticket page offers the same tabs and the choice holds for the session", async () => {
  const project = progressProject();
  const page = show(
    <TicketTab
      project={project}
      ticketId="t14"
      viewer="adam"
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
    />,
  );
  await openActivity();
  expect(await screen.findByRole("region", { name: "Compte rendu" })).toBeTruthy();
  page.unmount();
  sheet(project);
  expect(screen.getByRole("tab", { name: "Activité" }).getAttribute("aria-selected")).toBe("true");
  await userEvent.setup().click(await screen.findByRole("button", { name: /^Ancien/ }));
  await waitFor(() =>
    expect(calls.some((c) => c.method === "runMoments" && c.runId === REPORTED_RUN)).toBe(true),
  );
  expect(
    await screen.findByText("Je relis le récepteur et ses tests avant de toucher au port."),
  ).toBeTruthy();
});

test("the plan counts the moments of a step without the reasoning", async () => {
  sheet();
  const panel = await openActivity();
  const plan = await within(panel).findByRole("region", { name: "Plan" });
  const step = within(plan).getByRole("button", { name: /Corriger la validation du corps/ });
  await waitFor(() => expect(step.textContent).toContain("3 moments"));
});

test("the moments subscription ends with the tab and with the sheet", async () => {
  const view = sheet();
  await openActivity();
  await waitFor(() => expect(moments.on).toBe(1));
  await userEvent.setup().click(screen.getByRole("tab", { name: "Détails" }));
  await waitFor(() => expect(moments.off).toBe(1));
  await openActivity();
  await waitFor(() => expect(moments.on).toBe(2));
  view.unmount();
  expect(moments.off).toBe(2);
});
