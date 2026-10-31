import { beforeEach, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeldBand } from "./HeldBand";
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

function renderBand(groups = GROUPS, projectId = "p1") {
  const handlers = { onOpen: mock(), onResume: mock(), onResumeIn: mock() };
  const view = render(<HeldBand projectId={projectId} groups={groups} {...handlers} />);
  return { ...view, ...handlers };
}

beforeEach(() => localStorage.clear());

test("the band names its count and purpose, with one row per reason", () => {
  renderBand();
  const band = screen.getByRole("region", { name: "En attente (3)" });
  expect(within(band).getByText("étapes mises de côté, hors sprint")).toBeTruthy();
  expect(band.querySelector("svg")?.getAttribute("class")).toContain("text-(--tracking-hold)");
  const rule = within(band).getByRole("group", { name: "Règle de fusion à valider par le client" });
  expect(within(rule).getByText("Règle de fusion à valider par le client")).toBeTruthy();
  expect(within(rule).queryByText(/en dépendent/)).toBeNull();
  const server = within(band).getByRole("group", { name: "Serveur MinIO de recette indisponible" });
  expect(
    within(server)
      .getAllByRole("article")
      .map((a) => a.getAttribute("aria-label")),
  ).toEqual(["SILO-33 Écran d'envoi hors ligne", "SILO-82 Génération PDF"]);
  expect(within(server).getByText("2 en dépendent")).toBeTruthy();
});

test("a chip reads key, feature and title, and its title opens the step", async () => {
  const { onOpen } = renderBand();
  const chip = screen.getByRole("article", { name: "SILO-33 Écran d'envoi hors ligne" });
  expect(chip.textContent).toBe("SILO-33·F5Écran d'envoi hors ligne");
  await userEvent.setup().click(within(chip).getByRole("button", { name: "Écran d'envoi hors ligne" }));
  expect(onOpen).toHaveBeenCalledWith("id-SILO-33");
});

test("the chip menu resumes the step", async () => {
  const { onResume } = renderBand();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions de SILO-33" }));
  expect(screen.queryByRole("menuitem", { name: "Reprendre dans" })).toBeNull();
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre" }));
  expect(onResume).toHaveBeenCalledWith(GROUPS[1]?.steps[0]);
});

test("with resume targets, the menu also resumes the step in a sprint", async () => {
  const { onResumeIn } = renderBand();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions de SILO-45" }));
  await user.click(await screen.findByRole("menuitem", { name: "Reprendre dans" }));
  const item = await screen.findByRole("menuitem", { name: "S43 · Import et contrats" });
  expect(screen.getByRole("menuitem", { name: "S44 · Rapports" })).toBeTruthy();
  item.focus();
  await user.keyboard("{Enter}");
  expect(onResumeIn).toHaveBeenCalledWith(GROUPS[0]?.steps[0], "s43");
});

test("folded, the band keeps only its header, and the state is kept per project", async () => {
  const user = userEvent.setup();
  const first = renderBand();
  await user.click(screen.getByRole("button", { name: "Replier" }));
  expect(screen.getByText("étapes mises de côté, hors sprint")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.getByRole("button", { name: "Déplier" })).toBeTruthy();
  first.unmount();

  const again = renderBand();
  expect(screen.queryByRole("article")).toBeNull();
  again.unmount();

  renderBand(GROUPS, "p2");
  expect(screen.getAllByRole("article").length).toBe(3);
  await user.click(screen.getByRole("button", { name: "Replier" }));
  await user.click(screen.getByRole("button", { name: "Déplier" }));
  expect(screen.getAllByRole("article").length).toBe(3);
});

test("nothing is rendered without a step on hold", () => {
  const { container } = renderBand([]);
  expect(container.textContent).toBe("");
});
