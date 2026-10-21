import { expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeldSection } from "./HeldSection";
import type { HeldGroup, HeldStep } from "./held-model";

const step = (
  key: string,
  title: string,
  featureKey: string,
  resumeTargets: HeldStep["resumeTargets"] = [],
) => ({
  ticketId: `id-${key}`,
  key,
  title,
  featureId: `id-${featureKey}`,
  featureKey,
  reason: "",
  since: "2026-10-16",
  resumeTargets,
});

const S43 = { id: "s43", code: "S43", name: "Import et contrats" };
const S44 = { id: "s44", code: "S44", name: "Rapports" };

const GROUPS: HeldGroup[] = [
  {
    reason: "Règle de fusion à valider par le client",
    steps: [step("SILO-45", "Conflits de saisie", "F4", [S43, S44])],
    dependents: 0,
  },
  {
    reason: "Serveur MinIO de recette indisponible",
    steps: [step("SILO-33", "Écran d'envoi hors ligne", "F5"), step("SILO-82", "Génération PDF", "F7")],
    dependents: 2,
  },
];

function renderSection(groups = GROUPS, readOnly = false) {
  const handlers = { onOpen: mock(), onResume: mock(), onResumeIn: mock() };
  const { container } = render(<HeldSection groups={groups} readOnly={readOnly} {...handlers} />);
  return { container, ...handlers };
}

test("the section counts the steps on hold and groups them by reason", () => {
  renderSection();
  const section = screen.getByRole("region", { name: "En attente (3)" });
  expect(within(section).getByText("En attente (3)")).toBeTruthy();
  expect(section.querySelector("svg")?.getAttribute("class")).toContain("text-(--tracking-hold)");
  const rule = within(section).getByRole("group", { name: "Règle de fusion à valider par le client" });
  expect(within(rule).getByText("Règle de fusion à valider par le client")).toBeTruthy();
  const server = within(section).getByRole("group", { name: "Serveur MinIO de recette indisponible" });
  expect(
    within(server)
      .getAllByRole("article")
      .map((a) => a.getAttribute("aria-label")),
  ).toEqual(["SILO-33 Écran d'envoi hors ligne", "SILO-82 Génération PDF"]);
  expect(within(server).getByText("2 en dépendent")).toBeTruthy();
  expect(within(rule).queryByText(/en dépendent/)).toBeNull();
});

test("a step is a card on two lines: its key, feature and menu, then its title", async () => {
  const { onOpen } = renderSection();
  const card = screen.getByRole("article", { name: "SILO-33 Écran d'envoi hors ligne" });
  const [first, second] = Array.from(card.children);
  expect(first?.textContent).toBe("SILO-33·F5");
  expect(within(first as HTMLElement).getByRole("button", { name: "Actions de SILO-33" })).toBeTruthy();
  expect(second?.textContent).toBe("Écran d'envoi hors ligne");
  await userEvent.setup().click(within(card).getByRole("button", { name: "Écran d'envoi hors ligne" }));
  expect(onOpen).toHaveBeenCalledWith("id-SILO-33");
});

test("the card menu resumes the step", async () => {
  const { onResume } = renderSection();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions de SILO-33" }));
  expect(screen.queryByRole("menuitem", { name: "Reprendre dans" })).toBeNull();
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre" }));
  expect(onResume).toHaveBeenCalledWith(GROUPS[1]?.steps[0]);
});

test("with resume targets, the menu also resumes the step in a sprint", async () => {
  const { onResumeIn } = renderSection();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions de SILO-45" }));
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre dans" }));
  const item = await screen.findByRole("menuitem", { name: "S43 · Import et contrats" });
  expect(screen.getByRole("menuitem", { name: "S44 · Rapports" })).toBeTruthy();
  item.focus();
  await user.keyboard("{Enter}");
  expect(onResumeIn).toHaveBeenCalledWith(GROUPS[0]?.steps[0], "s43");
});

test("read only, the cards have no menu", () => {
  renderSection(GROUPS, true);
  expect(screen.getByRole("region", { name: "En attente (3)" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Actions de/ })).toBeNull();
});

test("nothing is rendered without a step on hold", () => {
  const { container } = renderSection([]);
  expect(container.querySelector("section")).toBeNull();
  expect(container.textContent).toBe("");
});
