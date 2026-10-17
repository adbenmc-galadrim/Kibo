import { expect, mock, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import { trackingBatch, trackingProject } from "./tracking-fixtures";

mock.module("../api", () =>
  apiMock({ client: { rpc: () => Promise.resolve({ skills: [] }), subscribeTopic: () => () => {} } }),
);

const { TrackingView } = await import("./TrackingView");

const SUMMARY = "F3 est livrée : 3 fonctionnalités sur 9.\n\nS42 finit ce soir et F5 n'y tiendra pas.";

function show(summary: string | null, withBatch = true) {
  const sent: string[] = [];
  const decided: [string, Decision][] = [];
  render(
    <TrackingView
      projectId="emis"
      projectName="Emis"
      summary={summary}
      batch={withBatch ? trackingBatch() : null}
      labels={projectLabels(trackingProject())}
      onTicket={() => {}}
      onDecide={async (id, d) => {
        decided.push([id, d]);
      }}
      onSend={async (text) => {
        sent.push(text);
      }}
    />,
  );
  return { sent, decided };
}

test("the summary is the agent's last message, the pending batch is to validate", async () => {
  show(SUMMARY);
  const summary = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(await summary.findByText("F3 est livrée : 3 fonctionnalités sur 9.")).toBeTruthy();
  const todo = within(screen.getByRole("region", { name: "À valider" }));
  expect(todo.getByRole("region", { name: "Lot n° 7" })).toBeTruthy();
  expect(todo.getByText("3 actions")).toBeTruthy();
  expect(todo.getByRole("button", { name: "Valider (3)" })).toBeTruthy();
  expect(todo.getByRole("button", { name: "Refuser" })).toBeTruthy();
  expect(
    screen.getByText(
      "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.",
    ),
  ).toBeTruthy();
});

test("validating from the card decides the pending batch", async () => {
  const { decided } = show(SUMMARY);
  await userEvent.setup().click(screen.getByRole("button", { name: "Valider (3)" }));
  await waitFor(() => expect(decided).toEqual([["b7", { decision: "apply", actionIds: [1, 2, 3] }]]));
});

test("without a batch the section is absent, without a message the summary invites to ask", () => {
  show(null, false);
  expect(screen.queryByRole("region", { name: "À valider" })).toBeNull();
  const summary = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(summary.getByText("Pose une question sur Emis ou attends la fin du sprint.")).toBeTruthy();
});

test("the box asks the project agent", async () => {
  const { sent } = show(null, false);
  const box = screen.getByRole("combobox", { name: "Message à l'agent de projet" });
  expect(box.getAttribute("placeholder")).toBe("Demander à l'agent de projet…");
  const user = userEvent.setup();
  await user.type(box, "Où en est F5 ?{Enter}");
  await waitFor(() => expect(sent).toEqual(["Où en est F5 ?"]));
});
