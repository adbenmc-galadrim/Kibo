import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { Batch, ProjectEvent, RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { pendingBatch, viewFixture } from "../project-agent/fixtures";
import { emisFeatureProject, NOW } from "./feature/fixture";

const calls: RpcRequest[] = [];
const journal: ProjectEvent[] = [];
const batches: Batch[] = [];

const answer = (req: RpcRequest): unknown => {
  if (req.method === "listProjectEvents") return { items: journal, nextBefore: null };
  if (req.method === "listCiRuns") return [];
  if (req.method === "getProjectAgent") return viewFixture({ batches });
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

beforeEach(() => {
  calls.length = 0;
  journal.length = 0;
  batches.length = 0;
});
afterEach(cleanup);

const renderFeature = () => {
  const project = emisFeatureProject();
  const feature = project.tickets.find((t) => t.id === "f5");
  if (!feature) throw new Error("fixture without F5");
  return render(
    <FeatureDetail
      project={project}
      ticket={feature}
      now={NOW}
      execution="hidden"
      onOpenFile={() => undefined}
      onOpenTicket={() => undefined}
    />,
  );
};

const commands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));
const decisions = () => calls.filter((c) => c.method === "decideBatch");
const aside = (name: string) => within(screen.getByRole("region", { name }));

test("the activity card reads the journal of the feature when it has facts", async () => {
  const event = (id: number, patch: Partial<ProjectEvent> & Pick<ProjectEvent, "kind">): ProjectEvent => ({
    id,
    projectId: "emis",
    at: NOW - 60_000,
    ticketId: null,
    featureId: "f5",
    source: "git",
    data: {},
    ...patch,
  });
  journal.push(
    event(3, { kind: "pr_opened", ticketId: "e32", data: { number: 22 } }),
    event(2, { kind: "batch_proposed", source: "project-agent", data: { seq: 7 } }),
  );
  renderFeature();
  expect(await aside("Activité").findByText("PR #22 ouverte · EMIS-32")).toBeTruthy();
  expect(aside("Activité").getByText("Suivi mis à jour · lot n° 7 proposé")).toBeTruthy();
  expect(calls).toContainEqual({ method: "listProjectEvents", projectId: "emis", featureId: "f5", limit: 5 });
});

test("a move proposed by the agent is applied alone from the sprint card, keeping the rest", async () => {
  batches.push(
    pendingBatch({
      id: "b7",
      seq: 7,
      actions: [
        { id: 1, why: "4 étapes restantes", type: "setSprint", ticket: "EMIS-30", sprint: "S43" },
        { id: 2, why: "seule à planifier", type: "setSprint", ticket: "EMIS-90", sprint: "S44" },
      ],
    }),
  );
  renderFeature();
  const sprint = aside("Sprint");
  expect(await sprint.findByText("proposé par l'agent")).toBeTruthy();
  await userEvent.setup().click(sprint.getByRole("button", { name: "Déplacer en S43" }));
  expect(decisions()).toEqual([
    {
      method: "decideBatch",
      projectId: "emis",
      batchId: "b7",
      decision: "apply",
      actionIds: [1],
      keepRest: true,
    },
  ]);
  expect(commands()).toEqual([]);
});

test("the step in a T3 Code session wears its pill, the execution being hidden", () => {
  renderFeature();
  expect(screen.getByText("session · T3 Code · 42 min")).toBeTruthy();
});
