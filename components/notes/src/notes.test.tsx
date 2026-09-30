import { expect, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import type { ProjectCommand } from "@kibo/schema";
import { type KiboSdk, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  seedDemo(run);
};

runConformance({ manifest, Component }, seed, { notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });

function setup(surface: "view" | "widget", notes: Record<string, string> = DEMO_NOTES) {
  const m = createMockSdk(manifest, { seed, surface, notes, noteAges: DEMO_NOTE_AGES });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}

const listed = () =>
  within(screen.getByRole("list", { name: "Notes" }))
    .getAllByRole("button")
    .filter((b) => !b.getAttribute("aria-label")?.startsWith("Actions de "))
    .map((b) => b.textContent);

test("screen 11: list, document, linked tickets and backlinks", async () => {
  const m = setup("view");
  await screen.findByRole("list", { name: "Notes" });
  await waitFor(() => expect(listed()).toHaveLength(4));
  expect(listed()).toEqual([
    "Décisions d'architectureaujourd'hui · 3 liens",
    "Journal agentshier",
    expect.stringMatching(/^Idées composants\d{2}\/\d{2}$/),
    expect.stringMatching(/^Réunion kick-off\d{2}\/\d{2}$/),
  ]);
  expect(await screen.findByText("~/goinfre/Kibo/notes")).toBeTruthy();
  expect(screen.getByText("Obsidian")).toBeTruthy();
  expect(await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" })).toBeTruthy();
  expect(screen.getByText("Enregistré • local")).toBeTruthy();
  const linked = screen.getByRole("region", { name: "Tickets liés" });
  expect(
    within(linked)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual([
    expect.stringContaining("KIB-12"),
    expect.stringContaining("KIB-13"),
    expect.stringContaining("KIB-14"),
  ]);
  const back = screen.getByRole("region", { name: "Rétroliens" });
  expect(within(back).getByText("mentionne cette note")).toBeTruthy();
  expect(within(back).getByText("2 mentions")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "notes/decisions-architecture.md" }));
  expect(m.openedFiles).toEqual([{ path: "notes/decisions-architecture.md" }]);
});

test("ticket chips and backlinks navigate", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  const doc = screen.getByRole("article");
  await user.click(within(doc).getAllByRole("button", { name: /KIB-12/ })[0] as HTMLElement);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-12")?.id ?? ""]);
  await user.click(
    within(screen.getByRole("region", { name: "Rétroliens" })).getByRole("button", {
      name: /Journal agents/,
    }),
  );
  expect(await screen.findByRole("heading", { level: 1, name: "Journal agents" })).toBeTruthy();
});

test("search asks the daemon, new note creates a file", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  await user.type(screen.getByPlaceholderText("Rechercher une note…"), "jeton");
  await waitFor(() => expect(listed()).toEqual([expect.stringContaining("Décisions d'architecture")]));
  await user.clear(screen.getByPlaceholderText("Rechercher une note…"));
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  await waitFor(() => expect(m.notes.has("sans-titre.md")).toBe(true));
  expect(m.notes.get("sans-titre.md")?.markdown).toBe("# Sans titre\n");
});

test("D4: the conflict banner offers reload and keep mine", async () => {
  const { NoteConflictBanner } = await import("./NoteDocument");
  const calls: string[] = [];
  render(<NoteConflictBanner onReload={() => calls.push("reload")} onKeepMine={() => calls.push("keep")} />);
  const user = userEvent.setup();
  expect(screen.getByRole("alert").textContent).toContain("Modifié hors de Kibo");
  await user.click(screen.getByRole("button", { name: "Recharger" }));
  await user.click(screen.getByRole("button", { name: "Garder ma version" }));
  expect(calls).toEqual(["reload", "keep"]);
});

test("D9: empty folder", async () => {
  setup("view", {});
  expect(await screen.findByText("Aucune note dans ce dossier.")).toBeTruthy();
  expect(screen.getByText("Choisis une note ou crées-en une.")).toBeTruthy();
});

test("screen 7 widget: the most recent note, title and first lines", async () => {
  const m = setup("widget");
  expect(await screen.findByRole("heading", { name: "Décisions d'architecture" })).toBeTruthy();
  expect(await screen.findByText(/On garde Loro comme CRDT/)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Décisions d'architecture" }));
  expect(m.openedViews).toEqual(["notes"]);
});

test("D9: empty widget", async () => {
  setup("widget", {});
  expect(await screen.findByText("Aucune note pour l'instant.")).toBeTruthy();
});

const editorView = async () => {
  const content = await screen.findByRole("textbox", { name: "Contenu de la note" });
  const view = EditorView.findFromDOM(content);
  if (!view) throw new Error("editor not mounted");
  return view;
};

test("the editor does not report a change it received from its value", async () => {
  const { MarkdownEditor } = await import("./MarkdownEditor");
  const changes: string[] = [];
  const { rerender } = render(<MarkdownEditor value="# Un" onChange={(md) => changes.push(md)} />);
  const view = await editorView();
  rerender(<MarkdownEditor value="# Deux" onChange={(md) => changes.push(md)} />);
  expect(view.state.doc.toString()).toBe("# Deux");
  expect(changes).toEqual([]);
  view.dispatch({ changes: { from: view.state.doc.length, insert: "!" }, userEvent: "input.type" });
  expect(changes).toEqual(["# Deux!"]);
});

test("a local unsaved edit survives an external change and shows the D4 banner", async () => {
  const m = createMockSdk(manifest, { seed, surface: "view", notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });
  const tree = (sdk: KiboSdk) => (
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>
  );
  const { rerender } = render(tree(m.sdk));
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({
    changes: { from: view.state.doc.length, insert: "\nMa frappe locale" },
    userEvent: "input.type",
  });
  const local = view.state.doc.toString();
  expect(await screen.findByText("Non enregistré")).toBeTruthy();
  const external = "# Décisions d'architecture\n\nRéécrit ailleurs.\n";
  m.touchNote("decisions-architecture.md", external);
  rerender(tree({ ...m.sdk }));
  expect((await screen.findByRole("alert", {}, { timeout: 3000 })).textContent).toContain(
    "Modifié hors de Kibo",
  );
  await new Promise((r) => setTimeout(r, 1000));
  expect(view.state.doc.toString()).toBe(local);
  expect(screen.getByRole("alert").textContent).toContain("Modifié hors de Kibo");
  expect(m.notes.get("decisions-architecture.md")?.markdown).toBe(external);
});

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

const noConflict = () =>
  expect(
    screen.queryAllByRole("alert").filter((a) => a.textContent?.includes("Modifié hors de Kibo")),
  ).toEqual([]);

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
  const m = createMockSdk(manifest, { seed, surface: "view", notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });
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
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  await waitFor(() => expect(m.notes.has("sans-titre.md")).toBe(true));
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

test("a read-only project shows no note menu", async () => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    notes: DEMO_NOTES,
    noteAges: DEMO_NOTE_AGES,
    shared: true,
  });
  m.setAccess("read-only");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByRole("list", { name: "Notes" });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions de / })).toBeNull());
  expect(screen.queryByRole("button", { name: "Nouvelle note" })).toBeNull();
});
