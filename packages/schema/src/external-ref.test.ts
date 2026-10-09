import { expect, test } from "bun:test";
import { branchRefOf, ExternalRef, ExternalRefKind, externalRefKey, externalRefTarget } from "./external-ref";
import { GitBranchRef } from "./git-branch";

const IDS = {
  file: "33333333-3333-4333-8333-333333333333",
  page: "44444444-4444-4444-8444-444444444444",
  board: "55555555-5555-4555-8555-555555555555",
};
const PENPOT_NEW = `https://design.penpot.app/#/view/${IDS.file}?page-id=${IDS.page}&board-id=${IDS.board}`;

test("a penpot board ref is keyed by file, page and board", () => {
  const ref = ExternalRef.parse({
    kind: "penpot_board",
    instance: "https://design.penpot.app",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
    url: PENPOT_NEW,
    name: "Accueil",
  });
  expect(externalRefKey(ref)).toBe(`${IDS.file}/${IDS.page}/${IDS.board}`);
  expect(externalRefTarget(ref)).toBe(`penpot_board:${IDS.file}/${IDS.page}/${IDS.board}`);
  expect(ExternalRefKind.options).toContain("penpot_board");
});

test("a penpot board ref refuses an http instance off loopback", () => {
  const ref = {
    kind: "penpot_board",
    instance: "http://192.168.1.2:9010",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
    url: PENPOT_NEW,
    name: "Accueil",
  };
  expect(ExternalRef.safeParse(ref).success).toBe(false);
});

test("branch and import refs have stable keys and a PR ref defaults base and head", () => {
  const branch = GitBranchRef.parse({ kind: "git_branch", branch: "feat/x", base: "feat/parent" });
  expect(externalRefKey(branch)).toBe("branch");
  expect(externalRefTarget(ExternalRef.parse({ kind: "import_ref", source: "plan", id: "C0-9" }))).toBe(
    "import_ref:plan:C0-9",
  );
  const pr = ExternalRef.parse({
    kind: "github_pr",
    url: "https://github.com/a/b/pull/4",
    number: 4,
    state: "open",
  });
  expect(pr).toMatchObject({ base: null, head: null });
  expect(branchRefOf([pr, branch])).toEqual(branch);
  expect(branchRefOf([pr])).toBeNull();
});
