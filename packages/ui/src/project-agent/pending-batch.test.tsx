import { expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Decision } from "./BatchCard";
import { projectLabels } from "./batch-groups";
import { PendingBatch } from "./PendingBatch";
import { trackingBatch, trackingProject } from "./tracking-fixtures";

function show() {
  const decisions: Decision[] = [];
  render(
    <PendingBatch
      batch={trackingBatch()}
      labels={projectLabels(trackingProject())}
      onDecide={async (d) => {
        decisions.push(d);
      }}
    />,
  );
  return { card: within(screen.getByRole("region", { name: "Lot n° 7" })), decisions };
}

test("the compact card lists each action with its title, its reason and a checked box", () => {
  const { card } = show();
  expect(card.getByText("3 actions")).toBeTruthy();
  const boxes = card.getAllByRole("checkbox");
  expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Reporter F5 en S43",
    "Planifier F9 en S44",
    "Relancer le client sur Q14",
  ]);
  expect(boxes.every((b) => b.getAttribute("aria-checked") === "true")).toBe(true);
  expect(card.getByText("4 étapes restantes, S42 finit aujourd'hui")).toBeTruthy();
  expect(card.getByRole("button", { name: "Valider (3)" })).toBeTruthy();
});

test("Valider applies the checked actions only", async () => {
  const { card, decisions } = show();
  const user = userEvent.setup();
  await user.click(card.getByRole("checkbox", { name: "Planifier F9 en S44" }));
  await user.click(card.getByRole("button", { name: "Valider (2)" }));
  await waitFor(() => expect(decisions).toEqual([{ decision: "apply", actionIds: [1, 3] }]));
});

test("Refuser asks for a confirmation before rejecting the batch", async () => {
  const { card, decisions } = show();
  const user = userEvent.setup();
  await user.click(card.getByRole("button", { name: "Refuser" }));
  expect(decisions).toEqual([]);
  await user.click(card.getByRole("button", { name: "Annuler" }));
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  await waitFor(() => expect(decisions).toEqual([{ decision: "reject" }]));
});
