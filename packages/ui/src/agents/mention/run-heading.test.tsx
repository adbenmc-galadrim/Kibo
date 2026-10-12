import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { NOW, runFixture } from "../fixtures";
import { RunHeading } from "./RunHeading";

const run = (id: string, startedAt: number) =>
  runFixture({
    id,
    label: "global · review-pr · KIB-3",
    agentName: "review-pr",
    profileName: "review-pr",
    agentScope: "global",
    ticketKey: "KIB-3",
    startedAt,
    state: "done",
  });

test("the heading names the run, its agent with its scope, and when it started", () => {
  render(<RunHeading run={run("a", NOW - 3_600_000)} onOpenTicket={() => {}} />);
  expect(screen.getByRole("heading", { level: 2, name: "global · review-pr · KIB-3" })).toBeTruthy();
  expect(screen.getByText("Agent review-pr · Global")).toBeTruthy();
});

test("two runs of the same agent on the same ticket differ by their start time", () => {
  const first = render(<RunHeading run={run("a", NOW - 3_600_000)} onOpenTicket={() => {}} />);
  const firstText = first.container.textContent;
  first.unmount();
  const second = render(<RunHeading run={run("b", NOW - 600_000)} onOpenTicket={() => {}} />);
  expect(second.container.textContent).not.toBe(firstText);
});
