import { expect, test } from "bun:test";
import type { GithubPrRef } from "@kibo/schema";
import { samePr } from "./pr-rules";

const ref: GithubPrRef = {
  kind: "github_pr",
  url: "https://github.com/a/b/pull/20",
  number: 20,
  state: "open",
  base: "dev",
  head: "feat/x",
  review: "none",
  checks: "error",
  failedCheck: "lint",
};

test("a PR whose failing check changes is not the same PR any more", () => {
  const { kind: _kind, ...info } = ref;
  expect(samePr(ref, info)).toBe(true);
  expect(samePr(ref, { ...info, failedCheck: "e2e" })).toBe(false);
  expect(samePr(ref, { ...info, failedCheck: null })).toBe(false);
  expect(samePr({ ...ref, failedCheck: undefined }, { ...info, failedCheck: null })).toBe(true);
});
