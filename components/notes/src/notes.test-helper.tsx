import { expect } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { ProjectCommand } from "@kibo/schema";
import { type KiboSdk, SdkProvider } from "@kibo/sdk";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";

export const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

export function mount(sdk: KiboSdk): void {
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
}

export function setup(surface: "view" | "widget", notes: Record<string, string> = DEMO_NOTES) {
  const m = createMockSdk(manifest, { seed, surface, notes, noteAges: DEMO_NOTE_AGES });
  mount(m.sdk);
  return m;
}

export const listed = () =>
  within(screen.getByRole("list", { name: "Notes" }))
    .getAllByRole("button")
    .filter((b) => !b.getAttribute("aria-label")?.startsWith("Actions de "))
    .filter((b) => !b.textContent?.startsWith("Fichier sans titre"))
    .map((b) => b.textContent);

export const editorView = async () => {
  const content = await screen.findByRole("textbox", { name: "Contenu de la note" });
  const view = EditorView.findFromDOM(content);
  if (!view) throw new Error("editor not mounted");
  return view;
};

export const noConflict = () =>
  expect(
    screen.queryAllByRole("alert").filter((a) => a.textContent?.includes("Modifié hors de Kibo")),
  ).toEqual([]);
