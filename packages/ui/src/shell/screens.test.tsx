import { expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";

mock.module("../api", () => ({ client: { pair: () => Promise.resolve() } }));

const { Overview } = await import("./Overview");
const { ProjectHome } = await import("../pages/ProjectHome");
const { PairingScreen } = await import("./PairingScreen");

const counts = { backlog: 1, todo: 9, in_progress: 6, in_review: 2, blocked: 1, done: 5 };
const kibo: ProjectSummary = {
  id: "p1",
  name: "Kibo",
  key: "KIB",
  folder: "/Users/adam/goinfre/Kibo",
  color: "#14B8A6",
  counts,
};
const portfolio: ProjectSummary = {
  ...kibo,
  id: "p2",
  name: "Portfolio",
  key: "POR",
  folder: null,
  counts: { ...counts, done: 0, todo: 4, in_progress: 1, blocked: 0, backlog: 0, in_review: 0 },
};

test("Overview greets the viewer and sums up the open work", () => {
  render(<Overview viewer="adam" projects={[kibo, portfolio]} onNewProject={() => {}} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bonjour Adam");
  expect(screen.getByText("2 projets · 24 tickets ouverts")).toBeTruthy();
});

test("Overview cards show counts, progress and a short folder", () => {
  render(<Overview viewer="adam" projects={[kibo]} onNewProject={() => {}} />);
  const card = screen.getByRole("article", { name: "Kibo" });
  expect(within(card).getByText("~/goinfre/Kibo")).toBeTruthy();
  expect(within(card).getByText("6").parentElement?.textContent).toBe("6 en cours");
  expect(within(card).getByText("9").parentElement?.textContent).toBe("9 à faire");
  expect(within(card).getByText("1").parentElement?.textContent).toBe("1 bloqué");
  const bar = within(card).getByRole("progressbar", { name: "5 terminés sur 24" });
  expect(bar.getAttribute("aria-valuenow")).toBe("5");
  expect(bar.getAttribute("aria-valuemax")).toBe("24");
});

const empty: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: "/Users/adam/goinfre/Kibo", color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  nextTicketKey: "KIB-1",
};

test("ProjectHome names the created project and its folder", () => {
  render(<ProjectHome project={empty} onNewPage={() => {}} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Projet créé : Kibo");
  expect(screen.getByText("~/goinfre/Kibo")).toBeTruthy();
});

test("PairingScreen shows the logo, a centred title and the security notice", () => {
  render(<PairingScreen onPaired={() => {}} />);
  expect(screen.getByRole("img", { name: "Kibo" })).toBeTruthy();
  expect(screen.getByText("Appairer ce navigateur")).toBeTruthy();
  expect(screen.getByText(/n'est jamais envoyé ailleurs/)).toBeTruthy();
});
