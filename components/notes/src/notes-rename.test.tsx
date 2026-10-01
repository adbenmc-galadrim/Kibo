import { expect, test } from "bun:test";
import type { KiboSdk } from "@kibo/sdk";
import { DEMO_NOTE_AGES, DEMO_NOTES } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manifest } from "./index";
import { editorView, listed, mount, noConflict, seed, setup } from "./notes.test-helper";

test("a note is renamed from its menu; the dialog previews the file, a taken name is refused", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Actions de Journal agents" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Renommer…",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  const field = within(dialog).getByLabelText("Titre");
  expect((field as HTMLInputElement).value).toBe("Journal agents");
  await user.clear(field);
  await user.type(field, "Décisions architecture");
  expect(within(dialog).getByText("Fichier : decisions-architecture.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Une note porte déjà ce nom.");
  await user.clear(field);
  await user.type(field, "Journal des agents");
  expect(within(dialog).getByText("Fichier : journal-des-agents.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(m.notes.has("journal-des-agents.md")).toBe(true));
  expect(m.notes.has("journal-agents.md")).toBe(false);
  await waitFor(() =>
    expect(listed()).toEqual(expect.arrayContaining([expect.stringContaining("Journal agents")])),
  );
});

test("deleting a note asks, removes the file and selects the next note", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.pointer({
    keys: "[MouseRight]",
    target: screen.getByRole("button", { name: /^Décisions d'architecture/ }),
  });
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", {
    name: "Supprimer la note « Décisions d'architecture » ?",
  });
  expect(confirm.textContent).toContain("Le fichier decisions-architecture.md sera supprimé du disque.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(m.notes.has("decisions-architecture.md")).toBe(false));
  expect(await screen.findByRole("heading", { level: 1, name: "Journal agents" })).toBeTruthy();
});

test("renaming the open note keeps what was just typed and saves to the new file", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({
    changes: { from: view.state.doc.length, insert: "\nFrappe récente" },
    userEvent: "input.type",
  });
  const typed = view.state.doc.toString();
  await user.click(screen.getByRole("button", { name: "Actions de Décisions d'architecture" }));
  await user.click(await screen.findByRole("menuitem", { name: "Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  const field = within(dialog).getByLabelText("Titre");
  await user.clear(field);
  await user.type(field, "Choix");
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(m.notes.get("choix.md")?.markdown).toBe(typed));
  expect(m.notes.has("decisions-architecture.md")).toBe(false);
  await new Promise((r) => setTimeout(r, 1000));
  expect(m.notes.get("choix.md")?.markdown).toBe(typed);
  noConflict();
  expect(view.state.doc.toString()).toBe(typed);
  view.dispatch({ changes: { from: view.state.doc.length, insert: " et suite" }, userEvent: "input.type" });
  await waitFor(() => expect(m.notes.get("choix.md")?.markdown).toBe(`${typed} et suite`), { timeout: 3000 });
  noConflict();
});

test("the first save of an untitled note renames its file after its title", async () => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    notes: { ...DEMO_NOTES, "sans-titre.md": "# Sans titre\n" },
    noteAges: DEMO_NOTE_AGES,
  });
  let reached: () => void = () => undefined;
  const saving = new Promise<void>((r) => {
    reached = r;
  });
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => {
    release = r;
  });
  const sdk: KiboSdk = {
    ...m.sdk,
    notes: {
      ...m.sdk.notes,
      write: async (path, markdown, mtime) => {
        if (path === "sans-titre.md" && mtime !== null) {
          reached();
          await held;
        }
        return m.sdk.notes.write(path, markdown, mtime);
      },
    },
  };
  mount(sdk);
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: /^Sans titre/ }));
  await screen.findByRole("heading", { level: 1, name: "Sans titre" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: "# Plan de test\n\nPremière ligne.\n" },
    userEvent: "input.type",
  });
  await saving;
  view.dispatch({ changes: { from: view.state.doc.length, insert: "Pendant." }, userEvent: "input.type" });
  release();
  await waitFor(
    () =>
      expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Plan de test\n\nPremière ligne.\nPendant."),
    { timeout: 3000 },
  );
  expect(m.notes.has("sans-titre.md")).toBe(false);
  expect(await screen.findByRole("button", { name: "notes/plan-de-test.md" })).toBeTruthy();
  expect(view.state.doc.toString()).toBe("# Plan de test\n\nPremière ligne.\nPendant.");
  noConflict();
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: "# Autre titre\n" },
    userEvent: "input.type",
  });
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Autre titre\n"), {
    timeout: 3000,
  });
  expect(m.notes.has("autre-titre.md")).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("untitled files are flagged in the list and renamed at their next save once titled", async () => {
  const m = setup("view", {
    ...DEMO_NOTES,
    "sans-titre.md": "Brouillon\n",
    "sans-titre-2.md": "# Sans titre\n\nNotes.\n",
  });
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  expect(screen.getAllByRole("button", { name: "Fichier sans titre · Renommer…" })).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: /^Sans titre/ }));
  await screen.findByRole("heading", { level: 1, name: "Sans titre" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({ changes: { from: 0, to: 12, insert: "# Plan de test" }, userEvent: "input.type" });
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Plan de test\n\nNotes.\n"), {
    timeout: 3000,
  });
  expect(m.notes.has("sans-titre-2.md")).toBe(false);
  expect(m.notes.has("sans-titre.md")).toBe(true);
  expect(await screen.findByRole("button", { name: "notes/plan-de-test.md" })).toBeTruthy();
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Fichier sans titre · Renommer…" })).toHaveLength(1),
  );
  await user.click(screen.getByRole("button", { name: "Fichier sans titre · Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  expect((within(dialog).getByLabelText("Titre") as HTMLInputElement).value).toBe("sans-titre");
});

test("a save that fires during a long rename ends up in the new file, without a conflict banner", async () => {
  const m = createMockSdk(manifest, { seed, surface: "view", notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => {
    release = r;
  });
  mount({
    ...m.sdk,
    notes: {
      ...m.sdk.notes,
      rename: async (from, to) => {
        const meta = await m.sdk.notes.rename(from, to);
        await held;
        return meta;
      },
    },
  });
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  await user.click(screen.getByRole("button", { name: "Actions de Décisions d'architecture" }));
  await user.click(await screen.findByRole("menuitem", { name: "Renommer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Renommer la note" });
  const field = within(dialog).getByLabelText("Titre");
  await user.clear(field);
  await user.type(field, "Choix");
  await user.click(within(dialog).getByRole("button", { name: "Renommer" }));
  await waitFor(() => expect(m.notes.has("choix.md")).toBe(true));
  view.dispatch({
    changes: { from: view.state.doc.length, insert: "\nPendant le renommage" },
    userEvent: "input.type",
  });
  const typed = view.state.doc.toString();
  await new Promise((r) => setTimeout(r, 1000));
  release();
  await waitFor(() => expect(m.notes.get("choix.md")?.markdown).toBe(typed), { timeout: 3000 });
  expect(await screen.findByText("Enregistré • local")).toBeTruthy();
  noConflict();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(view.state.doc.toString()).toBe(typed);
});
