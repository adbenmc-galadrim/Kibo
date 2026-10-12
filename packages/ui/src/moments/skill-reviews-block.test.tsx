import { expect, mock, test } from "bun:test";
import type { RunMoment } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reviewFixture } from "../skills/fixtures";
import { actions, FEED_RUN, SKILL_ACTIONS } from "./fixtures";
import { SkillReviewsBlock, usedSkills } from "./SkillReviewsBlock";

const moment = (list = SKILL_ACTIONS): RunMoment => ({
  id: 1,
  runId: FEED_RUN,
  seq: 1,
  at: 0,
  stepId: null,
  data: actions(list),
});

const REVIEWS = [
  reviewFixture(),
  reviewFixture({
    id: "rv2",
    skillId: "apply-review",
    verdict: "ok",
    note: "Les étapes ont suffi.",
    status: "ignored",
  }),
];

test("screen 196: each review names its skill, its verdict, its note and its state", async () => {
  const onOpenSkill = mock((_: string) => {});
  render(<SkillReviewsBlock runId={FEED_RUN} reviews={REVIEWS} usedSkills={2} onOpenSkill={onOpenSkill} />);
  const block = within(screen.getByRole("region", { name: "Reviews de skills" }));
  expect(block.getByText("2 skills utilisés")).toBeTruthy();
  const first = within(block.getByRole("listitem", { name: "porte-qualite" }));
  expect(first.getByText("À améliorer")).toBeTruthy();
  expect(first.getByText("À traiter")).toBeTruthy();
  expect(first.getByText(/Le volet conventions/)).toBeTruthy();
  const second = within(block.getByRole("listitem", { name: "apply-review" }));
  expect(second.getByText("OK")).toBeTruthy();
  expect(second.getByText("Ignorée")).toBeTruthy();
  await userEvent.setup().click(first.getByRole("button", { name: "porte-qualite" }));
  expect(onOpenSkill.mock.calls).toEqual([["porte-qualite"]]);
});

test("a run that used skills without review says so, a run without skill has no block", () => {
  const view = render(
    <SkillReviewsBlock runId={FEED_RUN} reviews={[]} usedSkills={1} onOpenSkill={() => {}} />,
  );
  expect(screen.getByText("Pas de review des skills")).toBeTruthy();
  view.unmount();
  const { container } = render(
    <SkillReviewsBlock runId={FEED_RUN} reviews={[]} usedSkills={0} onOpenSkill={() => {}} />,
  );
  expect(container.textContent).toBe("");
});

test("the skills used by a run are counted once each, refusals excluded", () => {
  expect(usedSkills([moment()])).toBe(1);
  expect(usedSkills([moment([...SKILL_ACTIONS, ...SKILL_ACTIONS])])).toBe(1);
  expect(usedSkills([moment([])])).toBe(0);
});
