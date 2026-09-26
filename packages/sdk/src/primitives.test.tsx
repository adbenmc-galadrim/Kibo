import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogTitle } from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";
import { Command, CommandInput, CommandItem, CommandList } from "./ui/command";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "./ui/context-menu";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

test("the new shadcn primitives render and are accessible", async () => {
  render(
    <>
      <Checkbox aria-label="Indexer" />
      <ToggleGroup type="single" defaultValue="unified" aria-label="Affichage">
        <ToggleGroupItem value="unified">Unifié</ToggleGroupItem>
        <ToggleGroupItem value="split">Côte à côte</ToggleGroupItem>
      </ToggleGroup>
      <Command label="Palette">
        <CommandInput placeholder="Rechercher" />
        <CommandList>
          <CommandItem>KIB-12</CommandItem>
        </CommandList>
      </Command>
      <ContextMenu>
        <ContextMenuTrigger>Onglet</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Dupliquer</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>,
  );
  expect(screen.getByRole("checkbox", { name: "Indexer" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Unifié" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("option", { name: "KIB-12" })).toBeTruthy();
  await userEvent.click(screen.getByRole("checkbox", { name: "Indexer" }));
  expect(screen.getByRole("checkbox", { name: "Indexer" }).getAttribute("aria-checked")).toBe("true");
});

test("the alert dialog is exposed as an alertdialog", () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Annuler des commits</AlertDialogTitle>
        <AlertDialogAction>OK</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>,
  );
  expect(screen.getByRole("alertdialog", { name: "Annuler des commits" })).toBeTruthy();
});
