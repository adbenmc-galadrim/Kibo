import { expect, test } from "bun:test";
import { TUTORIAL_NEVER, type TutorialState } from "@kibo/schema";
import { tutorialPanelVisible } from "./use-tutorial";

const demo = [{ id: "demo" }];
const at = (status: TutorialState["status"], projectId: string | null = "demo"): TutorialState => ({
  ...TUTORIAL_NEVER,
  status,
  projectId,
});

test("the panel shows while the tour runs or just ended, as long as the demo project exists", () => {
  expect(tutorialPanelVisible(at("active"), demo)).toBe(true);
  expect(tutorialPanelVisible(at("done"), demo)).toBe(true);
  expect(tutorialPanelVisible(at("done"), [])).toBe(false);
  expect(tutorialPanelVisible(at("active"), [{ id: "other" }])).toBe(false);
});

test("a paused, skipped or never started tour hides the panel", () => {
  for (const status of ["paused", "skipped", "never"] as const)
    expect(tutorialPanelVisible(at(status), demo)).toBe(false);
  expect(tutorialPanelVisible(null, demo)).toBe(false);
  expect(tutorialPanelVisible(at("active", null), demo)).toBe(false);
});
