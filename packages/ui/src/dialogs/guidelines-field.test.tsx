import { expect, mock, test } from "bun:test";
import type { TabTarget } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture, projectsFixture } from "../lib/fixtures";
import { GuidelinesField } from "./GuidelinesField";

const [kibo, fac] = projectsFixture;

test("the guidelines section counts the project's files and domains and opens its folder", async () => {
  if (!kibo) throw new Error("fixture without project");
  const go = mock((_target: TabTarget) => {});
  render(<GuidelinesField project={kibo} config={configFixture()} go={go} />);
  expect(screen.getByRole("heading", { name: "Guidelines" })).toBeTruthy();
  expect(
    screen.getByText("Les .md que reçoivent les agents des tickets de Kibo, après ceux du workspace."),
  ).toBeTruthy();
  expect(screen.getByText("6 fichiers .md · 2 domaines")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le dossier de guidelines →" }));
  expect(go).toHaveBeenCalledWith({ kind: "screen", screen: "domains", projectId: "kibo" });
});

test("a project without guidelines says so in the same words", () => {
  if (!fac) throw new Error("fixture without project");
  render(<GuidelinesField project={fac} config={configFixture()} go={() => {}} />);
  expect(screen.getByText("0 fichier .md · 0 domaine")).toBeTruthy();
});
