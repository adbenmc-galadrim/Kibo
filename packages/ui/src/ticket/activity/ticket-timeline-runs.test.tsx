import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { agentsFixture, kiboProject, runFixture } from "../../lib/fixtures";
import { AgentsProvider } from "../../state/agents-context";
import { TicketTimeline } from "./TicketTimeline";

afterEach(cleanup);

test("a ticket that had runs no longer shows a section for its old runs", () => {
  const project = kiboProject();
  const ticket = project.tickets[0];
  if (!ticket) throw new Error("a ticket");
  const agents = { ...agentsFixture(), runs: [runFixture({ id: "r1", ticketId: ticket.id, state: "done" })] };
  render(
    <AgentsProvider agents={agents}>
      <TicketTimeline project={project} ticket={ticket} journal={{ events: [], error: false }} ciRuns={[]} />
    </AgentsProvider>,
  );
  expect(screen.getByText("Chronologie")).toBeTruthy();
  expect(screen.queryByText("Anciens runs")).toBeNull();
});
