import { expect, mock, test } from "bun:test";
import type { RpcRequest, SkillAsset } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { skillFixture } from "./fixtures";

const LONG = "scripts/lib/plan/plan-data-js-avec-un-nom-vraiment-tres-long.mjs";
const MANY: SkillAsset[] = [
  ...Array.from({ length: 30 }, (_, i) => ({
    path: `reference/fichier-${i}.md`,
    size: 2_600 + i,
    text: true,
  })),
  { path: LONG, size: 5_900, text: true },
  { path: "scripts/install", size: 1_100, text: false },
];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => Promise.resolve(req.method === "skills.assets" ? MANY : { ok: true }),
      subscribeTopic: () => () => {},
      subscribe: () => () => {},
    },
  }),
);

const { SkillAssets } = await import("./SkillAssets");

const show = () =>
  render(<SkillAssets skill={skillFixture({ files: MANY })} current="SKILL.md" onPick={() => {}} />);

test("2026-10-14: the files column shows no size, only paths and their trash", async () => {
  show();
  const files = within(screen.getByRole("region", { name: "Fichiers" }));
  await files.findByText(LONG);
  expect(files.queryByText(/\d\s?(Ko|o)$/)).toBeNull();
  expect(files.getAllByRole("button", { name: /^Supprimer / })).toHaveLength(MANY.length);
});

test("2026-10-14: a long path is cut by an ellipsis and keeps its full path as a title", async () => {
  show();
  const path = await screen.findByText(LONG);
  expect(path.getAttribute("title")).toBe(LONG);
  expect(path.className).toContain("truncate");
});

test("2026-10-14: the files column scrolls on its own and never grows past its track", async () => {
  show();
  const column = screen.getByRole("region", { name: "Fichiers" });
  await within(column).findByText(LONG);
  expect(column.dataset.slot).toBe("scroll-pane");
  expect(column.className).toContain("grid-cols-[minmax(0,1fr)]");
  expect(column.querySelector("ul")?.className).toContain("grid-cols-[minmax(0,1fr)]");
});
