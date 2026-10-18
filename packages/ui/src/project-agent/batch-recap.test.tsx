import { expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchRecap } from "./BatchRecap";
import { projectLabels } from "./batch-groups";
import { decidedTrackingBatch, trackingProject } from "./tracking-fixtures";

function show(batch = decidedTrackingBatch()) {
  let closed = 0;
  render(
    <BatchRecap
      batch={batch}
      labels={projectLabels(trackingProject())}
      onClose={() => {
        closed++;
      }}
    />,
  );
  return { card: within(screen.getByRole("region", { name: "Lot n° 7 validé" })), closed: () => closed };
}

test("the recap counts applied, failed and skipped actions from the results", () => {
  const { card } = show();
  expect(card.getByText("2 appliquées · 1 échouée · 0 ignorée")).toBeTruthy();
});

test("each action says its outcome, a postponed feature says where it slipped from", () => {
  const { card } = show();
  const rows = card.getAllByRole("listitem").map((row) => row.textContent);
  expect(rows).toEqual([
    "Reporter F5 en S43appliquée · F5 glissée de S42",
    "Planifier F9 en S44appliquée",
    "Relancer le client sur Q14échouée · Q14 modifiée depuis la proposition",
  ]);
});

test("a skipped action counts as ignored", () => {
  const { card } = show(
    decidedTrackingBatch([
      { actionId: 1, outcome: "applied", detail: null, created: null },
      { actionId: 2, outcome: "skipped", detail: "décochée", created: null },
      { actionId: 3, outcome: "stale", detail: "Q14 modifiée depuis la proposition", created: null },
    ]),
  );
  expect(card.getByText("1 appliquée · 1 échouée · 1 ignorée")).toBeTruthy();
  expect(card.getByText("ignorée · décochée")).toBeTruthy();
});

test("Fermer closes the recap", async () => {
  const { card, closed } = show();
  await userEvent.setup().click(card.getByRole("button", { name: "Fermer" }));
  expect(closed()).toBe(1);
});

test("an applied reminder offers its text to copy for the recipient", async () => {
  const written: string[] = [];
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mock(async (text: string) => void written.push(text)) },
    configurable: true,
  });
  const { card } = show(
    decidedTrackingBatch([
      { actionId: 1, outcome: "applied", detail: null, created: null },
      { actionId: 2, outcome: "applied", detail: null, created: null },
      { actionId: 3, outcome: "applied", detail: null, created: null },
    ]),
  );
  expect(card.getAllByRole("button", { name: "Copier la relance" })).toHaveLength(1);
  await user.click(card.getByRole("button", { name: "Copier la relance" }));
  expect(written[0]?.split("\n")[1]).toBe("Je reviens vers vous au sujet de « Client - Logo ? »");
});

test("a failed reminder has nothing to copy", () => {
  const { card } = show();
  expect(card.queryByRole("button", { name: "Copier la relance" })).toBeNull();
});
