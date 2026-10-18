import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { CurrentSprintCard } from "./CurrentSprintCard";
import { DeadlinesCard } from "./DeadlinesCard";
import { build } from "./model-test-kit";
import { NextFeatureCard } from "./NextFeatureCard";

afterEach(cleanup);

const ignore = () => undefined;
const actions = {
  execution: "hidden" as const,
  copy: () => Promise.resolve(),
  deliver: () => Promise.resolve(),
  onOpenTicket: ignore,
};

test("the cards show the next sprint, the features ahead and the ones beyond the deadlines", () => {
  const { model } = build();
  const sprint = model.sprint;
  const next = model.next;
  if (sprint === null || next === null) throw new Error("cards");
  render(
    <>
      <CurrentSprintCard
        card={{ ...sprint, ahead: "hors sprint : F8 (S43)" }}
        onOpenTicket={ignore}
        onOpenSprint={ignore}
      />
      <NextFeatureCard card={{ ...next, from: "S43" }} actions={actions} />
      <DeadlinesCard deadlines={{ ...model.deadlines, later: 2 }} onOpenTicket={ignore} />
    </>,
  );
  expect(screen.getByText("hors sprint : F8 (S43)")).toBeTruthy();
  expect(screen.getByText("la plus avancée de S43")).toBeTruthy();
  expect(screen.getByText("fonctionnalités par sprint · + 2 plus tard")).toBeTruthy();
});
