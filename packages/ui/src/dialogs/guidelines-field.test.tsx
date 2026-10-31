import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { configFixture, projectsFixture } from "../lib/fixtures";
import { GuidelinesField } from "./GuidelinesField";

const [kibo, fac] = projectsFixture;

test("the guidelines section counts the project's files and domains", () => {
  if (!kibo) throw new Error("fixture without project");
  render(<GuidelinesField project={kibo} config={configFixture()} />);
  expect(screen.getByRole("heading", { name: "Guidelines" })).toBeTruthy();
  expect(
    screen.getByText("Les .md que reçoivent les agents des tickets de Kibo, après ceux du workspace."),
  ).toBeTruthy();
  expect(screen.getByText("6 fichiers .md · 2 domaines")).toBeTruthy();
});

test("a project without guidelines says so in the same words", () => {
  if (!fac) throw new Error("fixture without project");
  render(<GuidelinesField project={fac} config={configFixture()} />);
  expect(screen.getByText("0 fichier .md · 0 domaine")).toBeTruthy();
});
