import { expect, test } from "bun:test";
import type { ExternalRef, PrInfo } from "@kibo/schema";
import { trackedPr } from "./tracked-pr";

const pr = (number: number, extra: Partial<Extract<ExternalRef, { kind: "github_pr" }>> = {}) => ({
  kind: "github_pr" as const,
  url: `https://github.com/galadrimteam/emis/pull/${number}`,
  number,
  state: "draft" as const,
  base: "dev",
  head: null,
  ...extra,
});
const branch = (name: string): ExternalRef => ({ kind: "git_branch", branch: name, base: null });
const ticket = (externalRefs: ExternalRef[]) => ({ externalRefs });

test("the PR found by gh wins", () => {
  const found: PrInfo = { number: 3, url: pr(3).url, state: "open", base: "dev", head: "feat/x" };
  expect(trackedPr(found, [ticket([pr(9, { head: "feat/x" })])], "feat/x")).toBe(found);
});

test("otherwise a followed PR whose head is the branch, then the PR of the ticket of the branch", () => {
  const byHead = [ticket([pr(4, { head: "feat/y" })]), ticket([pr(9, { head: "feat/x" })])];
  expect(trackedPr(null, byHead, "feat/x")).toMatchObject({ number: 9, state: "draft" });
  const byTicket = [ticket([branch("feat/x"), pr(9)])];
  expect(trackedPr(null, byTicket, "feat/x")).toMatchObject({ number: 9, base: "dev" });
});

test("a closed or merged PR, another branch or no branch track nothing", () => {
  expect(trackedPr(null, [ticket([branch("feat/x"), pr(9, { state: "merged" })])], "feat/x")).toBeNull();
  expect(trackedPr(null, [ticket([pr(9, { head: "feat/x", state: "closed" })])], "feat/x")).toBeNull();
  expect(trackedPr(null, [ticket([branch("feat/y"), pr(9)])], "feat/x")).toBeNull();
  expect(trackedPr(null, [ticket([branch("feat/x"), pr(9)])], null)).toBeNull();
});
