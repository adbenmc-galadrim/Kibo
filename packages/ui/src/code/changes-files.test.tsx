import { expect, mock, test } from "bun:test";
import type { FileChange, Worktree } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const renderFiles = (files: FileChange[] | null, readOnly = false) => {
  const handlers = {
    onOpenInTab: mock((_: FileChange) => {}),
    onOpenExternal: mock((_: FileChange) => {}),
    onCopyPath: mock((_: FileChange) => {}),
    onDiscard: mock((_: FileChange) => {}),
    onStageAll: mock(() => {}),
    onUnstageAll: mock(() => {}),
  };
  render(
    <ChangesFiles
      worktrees={[worktree]}
      current={worktree}
      ahead={0}
      files={files}
      selected={null}
      busy={false}
      readOnly={readOnly}
      onWorktreeChange={() => {}}
      onSelect={() => {}}
      onToggle={() => {}}
      {...handlers}
    />,
  );
  return handlers;
};

test("before the first status the file list is a busy placeholder, not an empty list", () => {
  renderFiles(null);
  expect(screen.getByLabelText("Chargement des changements…").getAttribute("aria-busy")).toBe("true");
  expect(screen.queryByText("Aucun changement dans ce worktree.")).toBeNull();
  expect(screen.queryByRole("group")).toBeNull();
});

test("a loaded status shows its files, an empty one says the worktree is clean", () => {
  renderFiles([file]);
  expect(screen.getByRole("group", { name: "Indexés" }).textContent).toContain("ticket.ts");
  expect(screen.queryByLabelText("Chargement des changements…")).toBeNull();
  cleanup();
  renderFiles([]);
  expect(screen.getByText("Aucun changement dans ce worktree.")).toBeTruthy();
});

test("each row has a ⋯ menu and a context menu with the same entries; section headers stage or unstage everything", async () => {
  const { onStageAll, onUnstageAll, onDiscard, onCopyPath } = renderFiles([
    file,
    { ...file, path: "README.md", area: "unstaged", kind: "untracked" },
  ]);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions packages/core/ticket.ts" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
    "Désindexer",
    "Annuler les changements…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Copier le chemin" }));
  expect(onCopyPath).toHaveBeenCalledWith(file);
  await user.pointer({
    keys: "[MouseRight]",
    target: screen.getByRole("button", { name: /^nouveau README\.md/ }),
  });
  await user.click(await screen.findByRole("menuitem", { name: "Annuler les changements…" }));
  expect(onDiscard).toHaveBeenCalledWith(expect.objectContaining({ path: "README.md" }));
  await user.click(screen.getByRole("button", { name: "Tout indexer" }));
  expect(onStageAll).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Tout désindexer" }));
  expect(onUnstageAll).toHaveBeenCalledTimes(1);
});

test("empty sections have no bulk button", () => {
  renderFiles([file]);
  expect(screen.getByRole("button", { name: "Tout désindexer" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tout indexer" })).toBeNull();
});

test("a remote session has neither bulk buttons nor write entries in the menu", async () => {
  renderFiles([file, { ...file, path: "README.md", area: "unstaged", kind: "untracked" }], true);
  expect(screen.queryByRole("button", { name: /^Tout (dés)?indexer$/ })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Actions README.md" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Copier le chemin",
  ]);
});
