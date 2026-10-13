import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { projectsFixture } from "../agents/fixtures";
import { NodeHeader } from "./NodeHeader";

const kibo = projectsFixture[0] ?? null;

test("the workspace header counts its files and domains", () => {
  render(<NodeHeader project={null} files={2} domains={1} readOnly={false} />);
  expect(screen.getByRole("heading", { name: "Workspace" })).toBeTruthy();
  expect(screen.getByText("2 fichiers · 1 domaine")).toBeTruthy();
});

test("a project header names the project, its folder and counts, and says when it is read-only", () => {
  render(<NodeHeader project={kibo} files={0} domains={4} readOnly />);
  expect(screen.getByRole("heading", { name: "Projet · Kibo" })).toBeTruthy();
  expect(screen.getByText("/Users/adam/goinfre/Kibo").className).toContain("truncate");
  const counts = screen.getByText("0 fichier · 4 domaines");
  expect(counts.className).toContain("shrink-0");
  expect(counts.className).not.toContain("truncate");
  expect(screen.getByText("Lecture seule")).toBeTruthy();
});
