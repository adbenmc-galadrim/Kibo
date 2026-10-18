import { afterEach, expect, test } from "bun:test";
import type { ExternalRef, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { emisFeatureProject } from "../shell/feature/fixture";
import { TicketHeader } from "./TicketHeader";
import { headerContext } from "./tracking-model";

afterEach(cleanup);

const project = emisFeatureProject();
const e33 = project.tickets.find((t) => t.id === "e33") as TicketView;
const pr = (number: number, state: "open" | "merged" | "closed"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state,
  base: "dev",
  head: null,
  review: "none",
  checks: null,
});
const withRefs = (refs: ExternalRef[]): TicketView => ({ ...e33, externalRefs: refs });

test("a step names its feature, its sprint and its pull request: « F5 · S42 · PR #20 »", () => {
  expect(headerContext(withRefs([pr(20, "open")]), project)).toMatchObject({
    feature: true,
    text: "F5 · S42 · PR #20",
  });
  expect(headerContext(withRefs([pr(12, "closed"), pr(20, "open"), pr(18, "merged")]), project).text).toBe(
    "F5 · S42 · PR #20",
  );
  expect(headerContext(withRefs([pr(12, "closed"), pr(18, "merged")]), project).text).toBe(
    "F5 · S42 · PR #18",
  );
});

test("without a pull request the header stops at the sprint", () => {
  expect(headerContext(e33, project).text).toBe("F5 · S42");
});

test("a ticket outside any feature is named by its key", () => {
  const lone: TicketView = {
    ...e33,
    id: "e61",
    key: "EMIS-61",
    keyLabel: "EMIS-61",
    parentId: null,
    effectiveSprintId: null,
    externalRefs: [],
  };
  expect(headerContext(lone, project)).toMatchObject({ feature: false, text: "EMIS-61" });
  expect(headerContext({ ...lone, externalRefs: [pr(7, "open")] }, project).text).toBe("EMIS-61 · PR #7");
});

test("the header shows the key of the step, the context and a link to the pull request", () => {
  const { container } = render(<TicketHeader project={project} ticket={withRefs([pr(20, "open")])} />);
  expect(screen.getByText("EMIS-33")).toBeTruthy();
  expect(container.querySelector("[data-ticket-context]")?.textContent).toBe("F5 · S42 · PR #20");
  expect(screen.getByRole("link", { name: "PR #20" }).getAttribute("href")).toBe(
    "https://github.com/galadrim/emis/pull/20",
  );
});

test("the header of a lone ticket does not repeat its key", () => {
  const lone: TicketView = {
    ...e33,
    key: "EMIS-61",
    keyLabel: "EMIS-61",
    parentId: null,
    effectiveSprintId: null,
    externalRefs: [],
  };
  render(<TicketHeader project={project} ticket={lone} />);
  expect(screen.getAllByText("EMIS-61")).toHaveLength(1);
});
