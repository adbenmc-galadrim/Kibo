import { expect, test } from "bun:test";
import { NO_DIALOG } from "./ShellDialogs";
import { anyDialogOpen } from "./use-shell-dialogs";

test("a shell dialog or the palette counts as open, the default focus does not", () => {
  expect(anyDialogOpen({ ...NO_DIALOG, newProjectFocus: "folder" }, null)).toBe(false);
  expect(anyDialogOpen(NO_DIALOG, { newTab: false })).toBe(true);
  expect(anyDialogOpen({ ...NO_DIALOG, sheet: { projectId: "p1", ticketId: "1@2" } }, null)).toBe(true);
  expect(anyDialogOpen({ ...NO_DIALOG, newPageParent: null }, null)).toBe(true);
  expect(anyDialogOpen({ ...NO_DIALOG, tutorial: true }, null)).toBe(true);
});
