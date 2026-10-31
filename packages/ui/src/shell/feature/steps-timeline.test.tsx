import { afterEach, expect, test } from "bun:test";
import { DEFAULT_WORKFLOW } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stepModels } from "./feature-model";
import { NOW, siloFeatureProject } from "./fixture";
import { StepsTimeline } from "./StepsTimeline";

afterEach(cleanup);

const steps = stepModels(siloFeatureProject(), "f5", { ciRuns: [], now: NOW });

const renderTimeline = (opened: string[] = []) =>
  render(
    <StepsTimeline
      steps={steps}
      workflow={DEFAULT_WORKFLOW}
      now={NOW}
      nextId="e34"
      nextAction={<span>action suivante</span>}
      onOpenTicket={(id) => opened.push(id)}
    />,
  );

const rows = () => screen.getAllByRole("listitem");

test("each step shows its number or check, its title, its key and its state", () => {
  renderTimeline();
  expect(rows().map((r) => within(r).getByTestId("step-marker").textContent)).toEqual([
    "",
    "2",
    "3",
    "4",
    "5",
  ]);
  expect(rows().map((r) => r.getAttribute("data-status"))).toEqual([
    "done",
    "in_review",
    "in_progress",
    "todo",
    "todo",
  ]);
  const first = within(rows()[0] as HTMLElement);
  expect(first.getByText("Stockage des photos sur MinIO")).toBeTruthy();
  expect(first.getByText("SILO-31")).toBeTruthy();
  expect(first.getByText("Terminé")).toBeTruthy();
});

test("a step shows its PR or its branch, the time of its delivery step and the delivery bar", () => {
  renderTimeline();
  const [merged, review, coding] = rows().map((r) => within(r));
  expect(merged?.getByText("#19")).toBeTruthy();
  expect(merged?.getByText("fusionnée")).toBeTruthy();
  expect(merged?.getByRole("img", { name: "CI réussie" })).toBeTruthy();
  expect(review?.getByRole("img", { name: "CI réussie" })).toBeTruthy();
  expect(merged?.getByText("hier 18:22")).toBeTruthy();
  expect(merged?.getByText("Étape 11/12 · Livré")).toBeTruthy();
  expect(review?.getByText("#22")).toBeTruthy();
  expect(review?.getByText("15:04")).toBeTruthy();
  expect(review?.getByText("Étape 10/12 · Démo")).toBeTruthy();
  expect(coding?.getByText("feat/envoi-hors-ligne")).toBeTruthy();
  expect(coding?.getByText("14:51")).toBeTruthy();
  expect(coding?.getByText("Étape 7/12 · Porte qualité")).toBeTruthy();
  const bar = coding?.getByRole("progressbar", { name: "Étape 7/12 · Porte qualité" });
  if (!bar) throw new Error("no delivery bar");
  expect(Array.from(bar.querySelectorAll("[data-segment]"), (s) => s.getAttribute("data-segment"))).toEqual([
    ...Array(7).fill("done"),
    "current",
    ...Array(4).fill("todo"),
  ]);
});

test("a step in session wears the orange session pill", () => {
  renderTimeline();
  const coding = rows()[2] as HTMLElement;
  expect(within(coding).getByText("session · T3 Code · 42 min")).toBeTruthy();
  expect(coding.getAttribute("data-session")).toBe("true");
  expect(rows().filter((r) => r.getAttribute("data-session") === "true")).toHaveLength(1);
});

test("a waiting step says what it waits for and has no delivery yet", () => {
  renderTimeline();
  const tests = within(rows()[3] as HTMLElement);
  expect(tests.getByText("attend SILO-33")).toBeTruthy();
  expect(tests.getByText("—")).toBeTruthy();
  expect(tests.getByText("action suivante")).toBeTruthy();
  expect(within(rows()[4] as HTMLElement).queryByText("action suivante")).toBeNull();
});

test("clicking a step title opens its ticket", async () => {
  const opened: string[] = [];
  renderTimeline(opened);
  await userEvent.setup().click(screen.getByRole("button", { name: "Route d'envoi des photos" }));
  expect(opened).toEqual(["e32"]);
});

test("a PR with changes requested says so after its number, with a red mark for a failing CI", () => {
  const asked = steps.map((s) =>
    s.pr && s.key === "SILO-32"
      ? { ...s, ci: "error" as const, pr: { ...s.pr, review: "changes_requested" as const } }
      : s,
  );
  render(
    <StepsTimeline
      steps={asked}
      workflow={DEFAULT_WORKFLOW}
      now={NOW}
      nextId={null}
      nextAction={null}
      onOpenTicket={() => undefined}
    />,
  );
  const review = within(rows()[1] as HTMLElement);
  expect(review.getByText("changements demandés")).toBeTruthy();
  expect(review.getByRole("img", { name: "CI cassée" })).toBeTruthy();
});

test("a merged PR does not say changes requested", () => {
  const merged = steps.map((s) =>
    s.pr && s.key === "SILO-32"
      ? { ...s, pr: { ...s.pr, state: "merged" as const, review: "changes_requested" as const } }
      : s,
  );
  render(
    <StepsTimeline
      steps={merged}
      workflow={DEFAULT_WORKFLOW}
      now={NOW}
      nextId={null}
      nextAction={null}
      onOpenTicket={() => undefined}
    />,
  );
  const row = within(rows()[1] as HTMLElement);
  expect(row.getByText("fusionnée")).toBeTruthy();
  expect(row.queryByText("changements demandés")).toBeNull();
});
