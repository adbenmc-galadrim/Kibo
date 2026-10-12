import { beforeEach, expect, mock, test } from "bun:test";
import type { Overlap, RpcRequest, RunMomentsPage } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
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
