import { expect, spyOn, test } from "bun:test";
import { type KiboSdk, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { DEMO_NOTE_AGES, DEMO_NOTES } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { editorView, listed, mount, noConflict, seed, setup } from "./notes.test-helper";

runConformance({ manifest, Component }, seed, { notes: DEMO_NOTES, noteAges: DEMO_NOTE_AGES });

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

test("search asks the daemon, new note asks a title and refuses a taken name", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  await user.type(screen.getByPlaceholderText("Rechercher une note…"), "jeton");
  await waitFor(() => expect(listed()).toEqual([expect.stringContaining("Décisions d'architecture")]));
  await user.clear(screen.getByPlaceholderText("Rechercher une note…"));
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  const dialog = await screen.findByRole("dialog", { name: "Nouvelle note" });
  const field = within(dialog).getByLabelText("Titre");
  expect((within(dialog).getByRole("button", { name: "Créer" }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(field, "Journal agents");
  expect(within(dialog).getByText("Fichier : journal-agents.md")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Créer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Une note porte déjà ce nom.");
  expect(m.notes.get("journal-agents.md")?.markdown).toBe(DEMO_NOTES["journal-agents.md"]);
  await user.clear(field);
  await user.type(field, "Plan de test");
  await user.click(within(dialog).getByRole("button", { name: "Créer" }));
  await waitFor(() => expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Plan de test\n"));
  expect(m.notes.has("sans-titre.md")).toBe(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await screen.findByRole("textbox", { name: "Contenu de la note" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: "notes/plan-de-test.md" })).toBeTruthy();
});

test("a new note whose file appeared outside Kibo is refused by the folder, not overwritten", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  m.notes.set("plan-de-test.md", { markdown: "# Écrite dans Obsidian\n", mtime: 1 });
  await user.click(screen.getByRole("button", { name: "Nouvelle note" }));
  const dialog = await screen.findByRole("dialog", { name: "Nouvelle note" });
  await user.type(within(dialog).getByLabelText("Titre"), "Plan de test");
  await user.click(within(dialog).getByRole("button", { name: "Créer" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Une note porte déjà ce nom.");
  expect(m.notes.get("plan-de-test.md")?.markdown).toBe("# Écrite dans Obsidian\n");
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

test("a read-only project shows no note menu", async () => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    notes: { ...DEMO_NOTES, "sans-titre.md": "Brouillon\n" },
    noteAges: DEMO_NOTE_AGES,
    shared: true,
  });
  m.setAccess("read-only");
  mount(m.sdk);
  await screen.findByRole("list", { name: "Notes" });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions de / })).toBeNull());
  expect(screen.queryByRole("button", { name: "Nouvelle note" })).toBeNull();
  expect(screen.getByText("Fichier sans titre")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Fichier sans titre/ })).toBeNull();
});

test("notes are grouped by folder, root first; sorting by title is remembered on this device", async () => {
  localStorage.removeItem("kibo.notes.sort");
  const notes = {
    "zeta.md": "# Zêta\n",
    "alpha.md": "# Alpha\n",
    "idees/b.md": "# Idée B\n",
    "reunions/c.md": "# Réunion C\n",
  };
  const ages = { "zeta.md": 0, "alpha.md": 2, "idees/b.md": 1, "reunions/c.md": 3 };
  try {
    mount(createMockSdk(manifest, { seed, surface: "view", notes, noteAges: ages }).sdk);
    const user = userEvent.setup();
    const list = await screen.findByRole("list", { name: "Notes" });
    await waitFor(() => expect(within(list).getByRole("button", { name: "reunions" })).toBeTruthy());
    const titles = () =>
      within(list)
        .getAllByText(/^(Zêta|Alpha|Idée B|Réunion C|idees|reunions)$/)
        .map((e) => e.textContent);
    expect(titles()).toEqual(["Zêta", "Alpha", "idees", "Idée B", "reunions", "Réunion C"]);
    const folder = within(list).getByRole("button", { name: "idees" });
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    await user.click(folder);
    expect(within(list).queryByText("Idée B")).toBeNull();
    await user.click(folder);
    screen.getByRole("combobox", { name: "Trier" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.click(await screen.findByRole("option", { name: "Titre" }));
    await waitFor(() =>
      expect(titles()).toEqual(["Alpha", "Zêta", "idees", "Idée B", "reunions", "Réunion C"]),
    );
    expect(localStorage.getItem("kibo.notes.sort")).toBe("title");
  } finally {
    localStorage.removeItem("kibo.notes.sort");
  }
});

test("a stored sort is read back when the list opens", async () => {
  localStorage.setItem("kibo.notes.sort", "title");
  try {
    mount(
      createMockSdk(manifest, {
        seed,
        surface: "view",
        notes: { "b.md": "# Bêta\n", "a.md": "# Alpha\n" },
        noteAges: { "b.md": 0, "a.md": 1 },
      }).sdk,
    );
    const list = await screen.findByRole("list", { name: "Notes" });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByText(/^(Alpha|Bêta)$/)
          .map((e) => e.textContent),
      ).toEqual(["Alpha", "Bêta"]),
    );
    expect(screen.getByRole("combobox", { name: "Trier" }).textContent).toContain("Titre");
  } finally {
    localStorage.removeItem("kibo.notes.sort");
  }
});

const TASKS = { "taches.md": "# Tâches\n\n- [x] Relire la spec\n- [ ] Tester\n" };
const boxes = () => within(screen.getByRole("article")).getAllByRole<HTMLInputElement>("checkbox");

test("a checkbox toggled in reading mode is saved like an edit", async () => {
  const m = setup("view", TASKS);
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Tâches" });
  expect(boxes().map((b) => b.checked)).toEqual([true, false]);
  expect(screen.getByRole("article").textContent).not.toContain("[x]");
  await user.click(boxes()[1] as HTMLInputElement);
  await waitFor(() => expect(boxes().map((b) => b.checked)).toEqual([true, true]));
  await screen.findByText("Enregistré • local", {}, { timeout: 3000 });
  expect((await m.sdk.notes.read("taches.md")).markdown).toBe(
    "# Tâches\n\n- [x] Relire la spec\n- [x] Tester\n",
  );
  noConflict();
});

test("a conflict is not bypassed by a checkbox", async () => {
  const m = setup("view", TASKS);
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Tâches" });
  const writes = spyOn(m.sdk.notes, "write");
  const external = "# Tâches\n\n- [ ] Réécrit ailleurs\n";
  await user.click(boxes()[1] as HTMLInputElement);
  m.touchNote("taches.md", external);
  expect((await screen.findByRole("alert", {}, { timeout: 3000 })).textContent).toContain(
    "Modifié hors de Kibo",
  );
  await user.click(boxes()[0] as HTMLInputElement);
  await new Promise((r) => setTimeout(r, 1000));
  expect(screen.getByRole("alert").textContent).toContain("Modifié hors de Kibo");
  expect(writes.mock.calls.filter(([, , mtime]) => mtime === null)).toEqual([]);
  expect(m.notes.get("taches.md")?.markdown).toBe(external);
});
