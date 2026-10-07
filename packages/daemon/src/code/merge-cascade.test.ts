import { expect, test } from "bun:test";
import type { PrState } from "@kibo/schema";
import { mergeCascade, type PrTicket } from "./merge-cascade";

const pr = (id: string, head: string | null, base: string | null, state: PrState = "merged"): PrTicket => ({
  id,
  refs: [
    {
      kind: "github_pr",
      url: `https://github.com/a/b/pull/${id}`,
      number: Number(id),
      state,
      base,
      head,
    },
  ],
});

test("a merged stack resolves in one pass, open stacked PRs stay, cycles stop", () => {
  const t = [
    pr("1", "feat/a", "dev"),
    pr("2", "feat/b", "feat/a"),
    pr("3", "feat/c", "feat/b"),
    pr("4", "feat/d", "feat/a", "open"),
  ];
  expect(mergeCascade(t, "feat/a")).toEqual(["2", "3"]);
  expect(mergeCascade([pr("5", "x", "y"), pr("6", "y", "x")], "x")).toEqual(["6", "5"]);
  expect(mergeCascade(t, "nothing")).toEqual([]);
});

test("legacy refs without base or head never cascade", () => {
  expect(mergeCascade([pr("1", null, "feat/a"), pr("2", "feat/c", null)], "feat/a")).toEqual(["1"]);
  expect(mergeCascade([pr("1", null, "feat/a"), pr("2", "feat/c", null)], "feat/c")).toEqual([]);
});

test("tickets without a merged PR are ignored", () => {
  const branchOnly: PrTicket = { id: "9", refs: [{ kind: "git_branch", branch: "feat/b", base: "feat/a" }] };
  expect(mergeCascade([branchOnly, pr("2", "feat/b", "feat/a", "closed")], "feat/a")).toEqual([]);
});
