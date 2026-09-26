import { expect, test } from "bun:test";
import type { FileChange, Worktree } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { ChangesFiles } from "./ChangesFiles";

const worktree: Worktree = { path: "/repo", branch: "kib-12", head: "a".repeat(40), isMain: true };
const file: FileChange = {
  path: "packages/core/ticket.ts",
  origPath: null,
  area: "staged",
  kind: "modified",
  additions: 1,
  deletions: 1,
};

const renderFiles = (files: FileChange[] | null) =>
  render(
    <ChangesFiles
      worktrees={[worktree]}
      current={worktree}
      ahead={0}
      files={files}
      selected={null}
      busy={false}
      onWorktreeChange={() => {}}
      onSelect={() => {}}
      onToggle={() => {}}
    />,
  );

test("before the first status the file list is a busy placeholder, not an empty list", () => {
  renderFiles(null);
  expect(screen.getByLabelText("Chargement des changements…").getAttribute("aria-busy")).toBe("true");
  expect(screen.queryByText("Aucun changement dans ce worktree.")).toBeNull();
  expect(screen.queryByRole("group")).toBeNull();
});

test("a loaded status shows its files, an empty one says the worktree is clean", () => {
  const { unmount } = renderFiles([file]);
  expect(screen.getByRole("group", { name: "Indexés" }).textContent).toContain("ticket.ts");
  expect(screen.queryByLabelText("Chargement des changements…")).toBeNull();
  unmount();
  renderFiles([]);
  expect(screen.getByText("Aucun changement dans ce worktree.")).toBeTruthy();
});
