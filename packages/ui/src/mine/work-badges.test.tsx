import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { kib, mineTicket } from "./fixtures";
import { WorkBadges } from "./WorkBadges";
import type { WorkItem } from "./work-list";

afterEach(cleanup);

const adam = { kind: "human" as const, ref: "adam" };
const item = (patch: Partial<WorkItem["ticket"]>): WorkItem => ({
  project: kib,
  ticket: { ...mineTicket("KIB-33", "in_progress", adam), ...patch },
  pr: null,
  changes: false,
  ci: null,
  blockedBy: null,
  feature: null,
  branch: null,
});
const hold = { key: "KIB-33", reason: "Serveur MinIO de recette indisponible", since: "2026-10-16" };

test("a step on hold says its reason with the pause mark, even in progress", () => {
  const { container } = render(
    <WorkBadges
      item={item({ onHold: { ...hold, source: "own" }, startReason: { kind: "status" } })}
      waiting
    />,
  );
  expect(screen.getByText("en attente : Serveur MinIO de recette indisponible")).toBeTruthy();
  expect(container.querySelector(".lucide-pause")).not.toBeNull();
});

test("a step waiting on a held one names the held step", () => {
  render(<WorkBadges item={item({ statusId: "todo", onHold: { ...hold, source: "dependency" } })} waiting />);
  expect(screen.getByText("en attente de KIB-33")).toBeTruthy();
});
