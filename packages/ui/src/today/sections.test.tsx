import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { BlockingSection } from "./BlockingSection";
import { ProjectsList } from "./ProjectsList";
import { PrsSection } from "./PrsSection";
import { ticket } from "./today-fixtures";
import type { TodayBlocked, TodayPr, TodayProject } from "./today-model";

const ref = { projectId: "silo", projectKey: "SILO", folderMissing: false };
const noop = () => {};

const blockedRow = (reason: TodayBlocked["reason"]): TodayBlocked => ({
  ...ref,
  ticket: ticket({ id: "t", key: "SILO-51", title: "Lecture du fichier Excel" }),
  reason,
});

test("a blocked line gives its reason and the project key", () => {
  render(
    <BlockingSection
      rows={[blockedRow({ kind: "question", label: "Q14", feature: "F6", detail: null })]}
      questions={1}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("question · bloque F6 · Q14")).toBeTruthy();
  expect(screen.getByText("SILO")).toBeTruthy();
  expect(screen.getByText("1 ticket bloqué · 1 question bloquante · tous projets")).toBeTruthy();
});

test("the reason of a blocked ticket comes before its question", () => {
  render(
    <BlockingSection
      rows={[
        blockedRow({
          kind: "question",
          label: "Q14",
          feature: null,
          detail: "attend la validation du client",
        }),
      ]}
      questions={1}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("attend la validation du client · Q14")).toBeTruthy();
});

test("a blocked ticket without reason still says so", () => {
  render(
    <BlockingSection
      rows={[blockedRow({ kind: "status", detail: null })]}
      questions={0}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("bloqué")).toBeTruthy();
});

const prRow = (number: number, state: TodayPr["state"]): TodayPr => ({
  ...ref,
  ticket: ticket({ id: `t${number}`, key: `SILO-${number}`, title: `Titre ${number}` }),
  pr: {
    kind: "github_pr",
    url: `https://github.com/silo-labs/silo/pull/${number}`,
    number,
    state: "open",
    base: null,
    head: null,
    review: "none",
    checks: null,
  },
  state,
});

test("a pull request says where it stands, requested changes in amber", () => {
  render(
    <PrsSection
      rows={[
        prRow(20, "changes"),
        prRow(22, "ci-ok"),
        prRow(23, "ci-running"),
        prRow(24, "review"),
        prRow(25, "ci-failed"),
      ]}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByText("#20")).toBeTruthy();
  expect(screen.getByText("changements demandés").className).toContain("--tracking-amber");
  expect(screen.getByText("à relire · CI verte")).toBeTruthy();
  expect(screen.getByText("à relire · CI en cours")).toBeTruthy();
  expect(screen.getByText("à relire")).toBeTruthy();
  expect(screen.getByText("à relire · CI rouge")).toBeTruthy();
});

const projectRow: TodayProject = {
  id: "silo",
  key: "SILO",
  name: "Silo",
  color: "#14B8A6",
  client: "Silo SA",
  progress: { done: 3, total: 9 },
  open: 23,
  blocked: 2,
  risk: 1,
  sprint: "S42",
};

test("a project line carries progress, counts and sprint, its client under the name", () => {
  render(<ProjectsList projects={[projectRow]} onOpen={noop} />);
  expect(screen.getByText("client Silo SA")).toBeTruthy();
  expect(screen.getByText("3/9")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("3");
  for (const text of ["23 ouverts", "2 bloqués", "1 à risque", "S42"])
    expect(screen.getByText(text)).toBeTruthy();
});

test("quiet counts stay out, the key replaces a missing client", () => {
  render(
    <ProjectsList
      projects={[{ ...projectRow, client: null, blocked: 0, risk: 0, sprint: null }]}
      onOpen={noop}
    />,
  );
  expect(screen.getByText("SILO")).toBeTruthy();
  expect(screen.queryByText(/bloqué/)).toBeNull();
  expect(screen.queryByText(/à risque/)).toBeNull();
});

test("a new project offers Pour commencer instead of the bar", () => {
  render(
    <ProjectsList
      projects={[{ ...projectRow, progress: null, open: 0, blocked: 0, risk: 0, sprint: null }]}
      onOpen={noop}
    />,
  );
  expect(screen.getByText("Pour commencer")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.queryByText(/ouvert/)).toBeNull();
});
