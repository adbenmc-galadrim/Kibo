import { afterEach, expect, test } from "bun:test";
import type { ExternalRef, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { siloFeatureProject } from "../shell/feature/fixture";
import { TicketHeader } from "./TicketHeader";
import { headerContext } from "./tracking-model";

afterEach(cleanup);

const project = siloFeatureProject();
const e33 = project.tickets.find((t) => t.id === "e33") as TicketView;
const pr = (number: number, state: "open" | "merged" | "closed"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/silo-labs/silo-location/pull/${number}`,
  number,
  state,
  base: "dev",
  head: null,
  review: "none",
  checks: null,
});
const withRefs = (refs: ExternalRef[]): TicketView => ({ ...e33, externalRefs: refs });

test("a step names its feature and its sprint, never its pull request: « F5 · S42 »", () => {
  expect(headerContext(withRefs([pr(20, "open")]), project)).toMatchObject({
    feature: "F5",
    sprint: "S42",
    text: "F5 · S42",
  });
});

const lone: TicketView = {
  ...e33,
  id: "e61",
  key: "SILO-61",
  keyLabel: "SILO-61",
  parentId: null,
  effectiveSprintId: null,
  externalRefs: [],
};

test("a ticket outside any feature has no feature chip", () => {
  expect(headerContext(lone, project)).toMatchObject({ feature: null, text: "" });
  expect(headerContext({ ...lone, externalRefs: [pr(7, "open")] }, project).text).toBe("");
});

test("the chip line does not mention the pull request", () => {
  const { container } = render(<TicketHeader project={project} ticket={withRefs([pr(20, "open")])} />);
  expect(container.querySelector("[data-ticket-context]")?.textContent).toBe("F5 · S42");
  expect(screen.queryByRole("link")).toBeNull();
});

test("a lone ticket without sprint nor PR has no chip line", () => {
  const { container } = render(<TicketHeader project={project} ticket={lone} />);
  expect(container.querySelector("[data-ticket-context]")).toBeNull();
});
