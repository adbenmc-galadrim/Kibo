import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { NOW, runFixture } from "../fixtures";
import { DockRuns } from "./DockRuns";

test("a run that failed at launch shows why in the finished runs, not an empty report", () => {
  const failed = runFixture({
    id: "f1",
    ticketKey: "SILO-22",
    state: "failed",
    endedAt: NOW,
    error: "GIT_FAILED: remote feat not found",
  });
  render(
    <DockRuns
      groups={{ active: [], waiting: [], queued: [], recent: [failed] }}
      progress={[]}
      delivery={[]}
      questions={[]}
      now={NOW}
      selected={null}
      onSelect={() => {}}
    />,
  );
  expect(
    screen.getByText(
      "SILO-22 · Échec au lancement : git n'a pas pu préparer l'espace de travail (remote feat not found)",
    ),
  ).toBeTruthy();
});
