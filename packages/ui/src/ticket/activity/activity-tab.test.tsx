import { beforeEach, expect, mock, test } from "bun:test";
import type { Overlap, Question, RpcRequest, RunMomentsPage } from "@kibo/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NOW } from "../../agents/fixtures";
import { apiMock } from "../../api-mock";
import { dockState, FEED_RUN, MOMENTS_PAGE, progressProject } from "../../moments/fixtures";
import {
  autoLinkFixture,
  autoLinkMoment,
  FIRST_SEEN,
  momentOf,
  overlapFixture,
  overlapMoment,
  RESOLVED_AT,
} from "../../overlaps/fixtures";
import type { Host } from "../../shell/Host";
import { AgentsProvider } from "../../state/agents-context";

const calls: RpcRequest[] = [];
let page: RunMomentsPage = MOMENTS_PAGE;
let overlaps: Overlap[] = [];

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "runMoments") return req.runId === FEED_RUN ? page : { ...page, moments: [] };
        if (req.method === "overlaps.list") return overlaps;
        if (req.method === "autoLinks.list") return [autoLinkFixture()];
        if (req.method === "getProject") return progressProject();
        if (req.method === "skillReviews.list") return [];
        return null;
      },
      code: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      subscribeCode: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeMoments: () => () => undefined,
    },
  }),
);

const { ActivityTab } = await import("./ActivityTab");
const { HostProvider } = await import("../../shell/Host");

const withOverlapMoments = (): RunMomentsPage => ({
  ...MOMENTS_PAGE,
  moments: [
    ...MOMENTS_PAGE.moments,
    momentOf(20, FIRST_SEEN, overlapMoment(), FEED_RUN),
    momentOf(21, RESOLVED_AT, autoLinkMoment(), FEED_RUN),
  ],
});

const renderTab = () => {
  const project = progressProject();
  const ticket = project.tickets.find((t) => t.id === "t14");
  if (!ticket) throw new Error("no ticket t14");
  render(
    <AgentsProvider agents={dockState()}>
      <ActivityTab project={project} ticket={ticket} onOpenFile={() => {}} />
    </AgentsProvider>,
  );
};

beforeEach(() => {
  calls.length = 0;
  page = MOMENTS_PAGE;
  overlaps = [];
});

test("screen 199: the overlaps of the ticket's runs are counted under the report", async () => {
  page = withOverlapMoments();
  overlaps = [overlapFixture({ status: "resolved", resolvedAt: RESOLVED_AT })];
  renderTab();
  expect(await screen.findByText("Recouvrements : 1 réglé · 0 ouvert")).toBeTruthy();
  expect(calls).toContainEqual({ method: "overlaps.list", runId: FEED_RUN });
});

test("screen 199: the overlap and the automatic link are lines of the chronology", async () => {
  page = withOverlapMoments();
  overlaps = [overlapFixture({ status: "resolved", resolvedAt: RESOLVED_AT })];
  renderTab();
  await waitFor(() => expect(document.querySelector("[data-overlap='o1']")).toBeTruthy());
  expect(document.querySelector("[data-auto-link='a1']")?.textContent).toContain(
    "Kibo a lié BOU-12 → BOU-15",
  );
  expect(await screen.findByText(/^Réglé /)).toBeTruthy();
});

test("without any overlap there is no count and no overlap call", async () => {
  renderTab();
  await screen.findByText("Je relis le récepteur et ses tests avant de toucher au port.");
  expect(screen.queryByText(/^Recouvrements :/)).toBeNull();
  expect(calls.some((c) => c.method === "overlaps.list" || c.method === "autoLinks.list")).toBe(false);
});

test("a question line of the chronology previews its question and opens it", async () => {
  const project = progressProject();
  const ticket = project.tickets.find((t) => t.id === "t14");
  if (!ticket) throw new Error("no ticket t14");
  const asked: Question = {
    kind: "question",
    images: [],
    id: "q-port",
    ticketId: "t14",
    runId: FEED_RUN,
    title: "Quel port pour le récepteur ?",
    context: "Le port **4317** est pris par OpenTelemetry.",
    options: ["4318", "4400"],
    provisional: null,
    blocking: true,
    createdBy: { kind: "agent", ref: "opus-dev-2" },
    createdAt: NOW - 210 * 60_000,
    importRef: null,
    answer: null,
    recipient: "me",
    sentAt: null,
    history: [],
    archivedAt: null,
    archivedBy: null,
  };
  const opened: (string | undefined)[] = [];
  const host: Host = {
    openTicket: () => {},
    openNewTicket: () => {},
    openAssign: () => {},
    openFile: () => {},
    openView: (_id, _project, question) => opened.push(question),
    openTarget: () => {},
  };
  render(
    <HostProvider host={host}>
      <AgentsProvider agents={dockState()}>
        <ActivityTab project={{ ...project, questions: [asked] }} ticket={ticket} onOpenFile={() => {}} />
      </AgentsProvider>
    </HostProvider>,
  );
  const line = await screen.findByRole("button", { name: "Quel port pour le récepteur ?" });
  fireEvent.focus(line);
  expect(await screen.findByText("Le port 4317 est pris par OpenTelemetry.")).toBeTruthy();
  fireEvent.click(line);
  expect(opened).toEqual(["q-port"]);
});
