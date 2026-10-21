import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import type { Batch } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import type { ConversationItem } from "./conversation";
import { decidedTrackingBatch, trackingBatch, trackingProject } from "./tracking-fixtures";

mock.module("../api", () =>
  apiMock({ client: { rpc: () => Promise.resolve({ skills: [] }), subscribeTopic: () => () => {} } }),
);

const { TrackingView } = await import("./TrackingView");

const SUMMARY = "F3 est livrée : 3 fonctionnalités sur 9.\n\nS42 finit ce soir et F5 n'y tiendra pas.";
const AT = new Date(2026, 9, 16, 14, 48).getTime();
const agent = (id: string, text: string): ConversationItem => ({ kind: "agent", id, at: AT, text });
const user = (id: string, text: string): ConversationItem => ({ kind: "user", id, at: AT, text });
const summaryOnly = (summary: string | null): ConversationItem[] => (summary ? [agent("a1", summary)] : []);

beforeEach(() => setSystemTime(new Date(2026, 9, 16, 15, 0)));
afterEach(() => setSystemTime());

type Options = { items?: ConversationItem[]; withBatch?: boolean; superseded?: number; result?: Batch };

function show({ items = summaryOnly(SUMMARY), withBatch = true, superseded = 0, result }: Options = {}) {
  const sent: string[] = [];
  const decided: [string, Decision][] = [];
  let shownSuperseded = 0;
  render(
    <TrackingView
      projectId="silo"
      projectName="Silo"
      items={items}
      batch={withBatch ? trackingBatch() : null}
      superseded={superseded}
      labels={projectLabels(trackingProject())}
      onTicket={() => {}}
      onDecide={async (id, d) => {
        decided.push([id, d]);
        return result ?? trackingBatch({ status: "rejected" });
      }}
      onSend={async (text) => {
        sent.push(text);
      }}
      onShowSuperseded={() => {
        shownSuperseded++;
      }}
    />,
  );
  return { sent, decided, shownSuperseded: () => shownSuperseded };
}

test("the summary is the agent's last message, the pending batch is to validate", async () => {
  show();
  const summary = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(await summary.findByText("F3 est livrée : 3 fonctionnalités sur 9.")).toBeTruthy();
  expect(summary.queryByText("épinglé")).toBeNull();
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

test("the question asked shows under the pinned summary, the answer under the question", async () => {
  show({
    items: [
      agent("a1", SUMMARY),
      user("u1", "Où en est F5 ?"),
      agent("a2", "Il reste 4 étapes à F5 et S42 finit ce soir."),
    ],
  });
  const region = screen.getByRole("region", { name: "Résumé du jour" });
  expect(region.className).toContain("sticky");
  expect(within(region).getByText("épinglé")).toBeTruthy();
  const question = screen.getByText("Où en est F5 ?");
  const answer = await screen.findByText("Il reste 4 étapes à F5 et S42 finit ce soir.");
  expect(region.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(question.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("Toi · 14:48")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Lot n° 7" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "À valider" })).toBeNull();
});

test("a wakeup on an answer opens the exchange: the line, its time, then the agent and the batch", async () => {
  const wakeAt = new Date(2026, 9, 16, 14, 52).getTime();
  show({
    items: [
      agent("a1", SUMMARY),
      { kind: "wakeup", id: "w1", at: wakeAt, text: "Q16 répondue : « 5 Go »" },
      agent("a2", "Q16 répondue : le quota est de 5 Go par client. Je propose :"),
    ],
  });
  const region = screen.getByRole("region", { name: "Résumé du jour" });
  expect(within(region).getByText("épinglé")).toBeTruthy();
  const line = screen.getByText("Q16 répondue : « 5 Go »");
  expect(within(line.closest("li") ?? line).getByText("14:52")).toBeTruthy();
  const answer = await screen.findByText("Q16 répondue : le quota est de 5 Go par client. Je propose :");
  expect(line.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText(/^Toi · /)).toBeNull();
  expect(screen.getByRole("region", { name: "Lot n° 7" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "À valider" })).toBeNull();
});

test("the batch proposed after a wakeup says so on the card, as in the conversation", () => {
  show({
    items: [
      agent("a1", SUMMARY),
      { kind: "wakeup", id: "w1", at: AT, text: "Q16 répondue : « 5 Go »" },
      { kind: "batch", id: "batch-b7", at: AT, batch: trackingBatch(), afterWakeup: true },
    ],
  });
  const card = within(screen.getByRole("region", { name: "Lot n° 7" }));
  expect(card.getByText("3 actions · après réveil")).toBeTruthy();
});

test("validating from the card decides the pending batch and shows its recap until closed", async () => {
  const { decided } = show({ result: decidedTrackingBatch() });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Valider (3)" }));
  await waitFor(() => expect(decided).toEqual([["b7", { decision: "apply", actionIds: [1, 2, 3] }]]));
  const recap = within(await screen.findByRole("region", { name: "Lot n° 7 validé" }));
  expect(recap.getByText("2 appliquées · 1 échouée · 0 ignorée")).toBeTruthy();
  await user.click(recap.getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("region", { name: "Lot n° 7 validé" })).toBeNull();
});

test("hidden superseded batches are counted and can be shown", async () => {
  const { shownSuperseded } = show({ superseded: 1 });
  expect(screen.getByText("1 lot remplacé masqué")).toBeTruthy();
  const showButton = screen.getByRole("button", { name: "Afficher les lots remplacés" });
  expect(showButton.textContent).toBe("Afficher");
  await userEvent.setup().click(showButton);
  expect(shownSuperseded()).toBe(1);
});

test("without a batch the section is absent, without a message the summary invites to ask", () => {
  show({ items: [], withBatch: false });
  expect(screen.queryByRole("region", { name: "À valider" })).toBeNull();
  expect(screen.queryByText(/lots? remplacés? masqués?/)).toBeNull();
  const summary = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(summary.getByText("Pose une question sur Silo ou attends la fin du sprint.")).toBeTruthy();
});

test("the box asks the project agent", async () => {
  const { sent } = show({ items: [], withBatch: false });
  const box = screen.getByRole("combobox", { name: "Message à l'agent de projet" });
  expect(box.getAttribute("placeholder")).toBe("Demander à l'agent de projet…");
  const user = userEvent.setup();
  await user.type(box, "Où en est F5 ?{Enter}");
  await waitFor(() => expect(sent).toEqual(["Où en est F5 ?"]));
});

test("the summary is dated: its time today, its day and time before", () => {
  setSystemTime(new Date(2026, 9, 16, 15, 0));
  show();
  const today = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(today.getByText("14:48")).toBeTruthy();
  cleanup();
  setSystemTime(new Date(2026, 9, 17, 9, 0));
  show();
  const before = within(screen.getByRole("region", { name: "Dernier résumé" }));
  expect(before.getByText("16 oct. · 14:48")).toBeTruthy();
  cleanup();
  setSystemTime(new Date(2026, 9, 15, 9, 0));
  show();
  expect(screen.getByRole("region", { name: "Résumé du jour" })).toBeTruthy();
});

test("a first question and its answer both show, under the invitation instead of a summary", async () => {
  show({ items: [user("u1", "Où en est F5 ?"), agent("a1", "Il reste 4 étapes.")], withBatch: false });
  const region = within(screen.getByRole("region", { name: "Résumé du jour" }));
  expect(region.getByText("Pose une question sur Silo ou attends la fin du sprint.")).toBeTruthy();
  expect(region.getByText("épinglé")).toBeTruthy();
  expect(screen.getByText("Où en est F5 ?")).toBeTruthy();
  expect(await screen.findByText("Il reste 4 étapes.")).toBeTruthy();
});
