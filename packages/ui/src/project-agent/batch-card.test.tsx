import { expect, test } from "bun:test";
import type { Batch } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchCard, type Decision } from "./BatchCard";
import { defaultLabels, projectLabels } from "./batch-groups";
import { emisProject, partialBatch, pendingBatch } from "./fixtures";

function show(batch: Batch, readOnly = false) {
  const decisions: Decision[] = [];
  render(
    <BatchCard
      batch={batch}
      labels={projectLabels(emisProject())}
      readOnly={readOnly}
      onDecide={async (d) => {
        decisions.push(d);
      }}
    />,
  );
  const card = within(screen.getByRole("region", { name: /Lot n° 1/ }));
  return { decisions, card };
}

test("a pending batch shows its summary, four groups, every box checked and Valider (7)", () => {
  const { card } = show(pendingBatch());
  expect(card.getByText("Passer EMIS-11 en review et lancer l'export")).toBeTruthy();
  expect(card.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
    "Tickets",
    "Agents",
    "Questions",
    "Notes",
  ]);
  const boxes = card.getAllByRole("checkbox");
  expect(boxes).toHaveLength(7);
  expect(boxes.every((b) => b.getAttribute("aria-checked") === "true")).toBe(true);
  expect(card.getByRole("button", { name: "Valider (7)" })).toBeTruthy();
  expect(card.getByText("En cours")).toBeTruthy();
  expect(card.getByText("En review")).toBeTruthy();
  expect(card.getByText("Export CSV")).toBeTruthy();
  expect(card.getByText("Le code est prêt")).toBeTruthy();
  expect(card.getByText("contenu remplacé")).toBeTruthy();
});

test("Valider counts the checked boxes and sends only them, in order", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("checkbox", { name: "Assigner EMIS-12 à opus" }));
  await user.click(card.getByRole("checkbox", { name: /^Question sur EMIS-12/ }));
  await user.click(card.getByRole("button", { name: "Valider (5)" }));
  expect(decisions).toEqual([{ decision: "apply", actionIds: [1, 2, 3, 6, 7] }]);
});

test("each group checks or unchecks all its actions; nothing checked disables Valider", async () => {
  const { card } = show(pendingBatch());
  const user = userEvent.setup();
  const tickets = within(card.getByRole("group", { name: "Tickets" }));
  await user.click(tickets.getByRole("button", { name: "Tout décocher" }));
  expect(card.getByRole("button", { name: "Valider (4)" })).toBeTruthy();
  await user.click(tickets.getByRole("button", { name: "Tout cocher" }));
  expect(card.getByRole("button", { name: "Valider (7)" })).toBeTruthy();
  for (const group of ["Tickets", "Agents", "Questions", "Notes"])
    await user.click(
      within(card.getByRole("group", { name: group })).getByRole("button", { name: "Tout décocher" }),
    );
  expect((card.getByRole("button", { name: "Valider (0)" }) as HTMLButtonElement).disabled).toBe(true);
});

test("Refuser asks for an optional comment, then rejects with it", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.type(
    card.getByRole("textbox", { name: "Commentaire pour l'agent (facultatif)" }),
    "Pas maintenant",
  );
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  expect(decisions).toEqual([{ decision: "reject", comment: "Pas maintenant" }]);
});

test("a refusal without comment sends no comment", async () => {
  const { card, decisions } = show(pendingBatch());
  const user = userEvent.setup();
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  expect(decisions).toEqual([{ decision: "reject" }]);
});

test("after the decision each action shows its result and no box or button remains", () => {
  const { card } = show({ ...partialBatch(), seq: 1 });
  expect(card.getByText("Appliqué en partie")).toBeTruthy();
  expect(card.queryAllByRole("checkbox")).toHaveLength(0);
  expect(card.queryAllByRole("button")).toHaveLength(0);
  expect(card.getAllByText("Appliquée")).toHaveLength(3);
  expect(card.getByText("Périmée")).toBeTruthy();
  expect(card.getByText("Échec")).toBeTruthy();
  expect(card.getByText("profil désactivé")).toBeTruthy();
  expect(card.getAllByText("Ignorée")).toHaveLength(2);
  expect(card.getByText("EMIS-13")).toBeTruthy();
});

test("a batch being applied (partial without results) says so and never shows a failure", () => {
  const { card } = show(pendingBatch({ status: "partial", decidedAt: 1, chosen: [1], results: [] }));
  expect(card.getByText("Application en cours…")).toBeTruthy();
  expect(card.queryByText("Échec")).toBeNull();
  expect(card.queryByText("Appliqué en partie")).toBeNull();
  expect(card.queryAllByRole("button")).toHaveLength(0);
});

test("superseded, abandoned and rejected batches carry only their label", () => {
  for (const [status, label] of [
    ["superseded", "Remplacé par un lot plus récent"],
    ["abandoned", "Abandonné"],
    ["rejected", "Refusé"],
  ] as const) {
    const view = render(
      <BatchCard
        batch={pendingBatch({ status })}
        labels={defaultLabels}
        readOnly={false}
        onDecide={async () => {}}
      />,
    );
    const card = within(view.getByRole("region", { name: /Lot n° 1/ }));
    expect(card.getByText(label)).toBeTruthy();
    expect(card.queryAllByRole("checkbox")).toHaveLength(0);
    expect(card.queryAllByRole("button")).toHaveLength(0);
    view.unmount();
  }
});

test("a pending batch read from an old agent cannot be decided", () => {
  const { card } = show(pendingBatch(), true);
  expect(card.queryAllByRole("checkbox")).toHaveLength(0);
  expect(card.queryByRole("button", { name: /Valider/ })).toBeNull();
});
