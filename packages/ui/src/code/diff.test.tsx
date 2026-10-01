import { expect, test } from "bun:test";
import type { FileChange, FileDiff, Hunk } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffToolbar } from "./DiffToolbar";
import { DiffView } from "./DiffView";
import { splitRows } from "./diff-rows";
import { FileList } from "./FileList";

const hunk: Hunk = {
  header: "@@ -38,3 +38,4 @@ export const TicketSchema",
  oldStart: 38,
  oldLines: 3,
  newStart: 38,
  newLines: 4,
  section: "export const TicketSchema",
  lines: [
    { kind: "context", text: "export const TicketSchema = z.object({", oldNo: 38, newNo: 38, noEol: false },
    { kind: "del", text: "  parentId: z.string().nullable(),", oldNo: 39, newNo: null, noEol: false },
    { kind: "add", text: "  key: z.string(),", oldNo: null, newNo: 39, noEol: false },
    { kind: "add", text: "  statusId: z.string(),", oldNo: null, newNo: 40, noEol: false },
    { kind: "context", text: "});", oldNo: 40, newNo: 41, noEol: false },
  ],
};
const diff: FileDiff = {
  path: "packages/core/ticket.ts",
  origPath: null,
  binary: false,
  hunkStaging: true,
  additions: 2,
  deletions: 1,
  hunks: [hunk],
};

test("splitRows pairs deletions with additions and repeats context", () => {
  expect(splitRows(hunk).map((r) => [r.left?.oldNo ?? null, r.right?.newNo ?? null])).toEqual([
    [38, 38],
    [39, 39],
    [null, 40],
    [40, 41],
  ]);
});

test("the unified diff shows numbers and signs, the hunk button stages", async () => {
  const hunks: [number, string][] = [];
  render(
    <DiffView
      diff={diff}
      area="unstaged"
      mode="unified"
      busy={false}
      onHunk={(i, h) => hunks.push([i, h])}
    />,
  );
  const section = screen.getByRole("region", { name: hunk.header });
  expect(within(section).getByText("key: z.string(),")).toBeTruthy();
  await userEvent.click(within(section).getByRole("button", { name: "Ajouter le bloc au commit" }));
  expect(hunks).toEqual([[0, hunk.header]]);
});

test("staged diffs offer to unstage, binary files and whole-file-only diffs hide the hunk action", () => {
  const { rerender } = render(
    <DiffView diff={diff} area="staged" mode="split" busy={false} onHunk={() => {}} />,
  );
  expect(screen.getByRole("button", { name: "Retirer le bloc du commit" })).toBeTruthy();
  rerender(
    <DiffView
      diff={{ ...diff, hunkStaging: false }}
      area="unstaged"
      mode="unified"
      busy={false}
      onHunk={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Ajouter le bloc au commit" })).toBeNull();
  rerender(
    <DiffView
      diff={{ ...diff, binary: true, hunks: [] }}
      area="unstaged"
      mode="unified"
      busy={false}
      onHunk={() => {}}
    />,
  );
  expect(screen.getByText("Fichier binaire : aucun diff à afficher.")).toBeTruthy();
});

test("the toolbar switches modes, toggles editing and opens the file", async () => {
  const events: string[] = [];
  render(
    <DiffToolbar
      path="packages/core/ticket.ts"
      additions={42}
      deletions={8}
      mode="unified"
      onModeChange={(m) => events.push(m)}
      editing={false}
      onEditingChange={(e) => events.push(`edit:${e}`)}
      canEdit
      readOnly={false}
      onOpenFile={() => events.push("file")}
      onOpenExternal={() => events.push("external")}
    />,
  );
  await userEvent.click(screen.getByRole("radio", { name: "Côte à côte" }));
  await userEvent.click(screen.getByRole("button", { name: "Édition" }));
  await userEvent.click(screen.getByRole("button", { name: "packages/core/ticket.ts" }));
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir dans l'éditeur externe" }));
  expect(events).toEqual(["split", "edit:true", "file", "external"]);
  expect(screen.getByText("+42")).toBeTruthy();
});

test("the file list groups by area and toggles staging per file", async () => {
  const files: FileChange[] = [
    {
      path: "packages/core/ticket.ts",
      origPath: null,
      area: "staged",
      kind: "modified",
      additions: 42,
      deletions: 8,
    },
    {
      path: "packages/core/tree.ts",
      origPath: null,
      area: "staged",
      kind: "added",
      additions: 120,
      deletions: 0,
    },
    {
      path: "packages/core/index.ts",
      origPath: null,
      area: "unstaged",
      kind: "modified",
      additions: 3,
      deletions: 1,
    },
    {
      path: "packages/core/legacy-tree.ts",
      origPath: null,
      area: "unstaged",
      kind: "deleted",
      additions: 0,
      deletions: 56,
    },
  ];
  const toggled: string[] = [];
  const selected: string[] = [];
  render(
    <FileList
      files={files}
      selected={{ path: "packages/core/ticket.ts", area: "staged" }}
      busy={false}
      readOnly={false}
      onSelect={(f) => selected.push(`${f.area}:${f.path}`)}
      onToggle={(f) => toggled.push(`${f.area}:${f.path}`)}
      onOpenInTab={() => {}}
      onOpenExternal={() => {}}
      onCopyPath={() => {}}
      onDiscard={() => {}}
      onStageAll={() => {}}
      onUnstageAll={() => {}}
    />,
  );
  const staged = screen.getByRole("group", { name: "Dans le prochain commit (2)" });
  const changes = screen.getByRole("group", { name: "Modifications (2)" });
  expect(within(staged).getByText("Modifié").getAttribute("aria-hidden")).toBeNull();
  expect(within(staged).getByText("Ajouté")).toBeTruthy();
  expect(within(changes).getByText("Supprimé")).toBeTruthy();
  expect(within(staged).getAllByRole("checkbox")).toHaveLength(2);
  expect(
    within(staged)
      .getByRole("checkbox", { name: "Retirer packages/core/ticket.ts du commit" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  await userEvent.click(screen.getByRole("checkbox", { name: "Ajouter packages/core/index.ts au commit" }));
  await userEvent.click(screen.getByRole("button", { name: /^Supprimé legacy-tree\.ts/ }));
  expect(toggled).toEqual(["unstaged:packages/core/index.ts"]);
  expect(selected).toEqual(["unstaged:packages/core/legacy-tree.ts"]);
  await userEvent.click(screen.getByRole("button", { name: /Dans le prochain commit/ }));
  expect(within(staged).queryAllByRole("checkbox")).toHaveLength(0);
});
