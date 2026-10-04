import { expect, test } from "bun:test";
import { acceptCompletion, currentCompletions } from "@codemirror/autocomplete";
import type { TransactionSpec } from "@codemirror/state";
import { type EditorView, runScopeHandlers } from "@codemirror/view";
import { createEvent, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { editorView, setup } from "./notes.test-helper";

const modKey = (key: string) =>
  new KeyboardEvent("keydown", {
    key,
    metaKey: /Mac/.test(navigator.platform),
    ctrlKey: !/Mac/.test(navigator.platform),
  });

const blurredEditor = async () => {
  const view = await editorView();
  const user = userEvent.setup();
  const blurred = <T,>(act: () => T): T => {
    view.contentDOM.blur();
    return act();
  };
  return {
    view,
    press: (target: HTMLElement) => blurred(() => user.click(target)),
    edit: (spec: TransactionSpec) => blurred(() => view.dispatch(spec)),
    shortcut: (key: string) => blurred(() => runScopeHandlers(view, modKey(key), "editor")),
    choose: async (item: string) => {
      (await screen.findByRole("menuitem", { name: item })).focus();
      await user.keyboard("{Enter}");
    },
  };
};

test("the toolbar formats the selection and ⌘B, ⌘I, ⌘E are bound", async () => {
  setup("view");
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Modifier" }));
  const { view, press, edit, shortcut, choose } = await blurredEditor();
  const text = () => view.state.doc.toString();
  edit({
    changes: { from: 0, to: view.state.doc.length, insert: "un mot" },
    selection: { anchor: 3, head: 6 },
  });
  const toolbar = screen.getByRole("toolbar", { name: "Mise en forme" });
  await press(within(toolbar).getByRole("button", { name: "Gras" }));
  expect(text()).toBe("un **mot**");
  expect(view.hasFocus).toBe(true);
  edit({ selection: { anchor: 5, head: 8 } });
  await press(within(toolbar).getByRole("button", { name: "Italique" }));
  expect(text()).toBe("un ***mot***");
  await press(within(toolbar).getByRole("button", { name: "Titre" }));
  await choose("Titre 2");
  expect(text()).toBe("## un ***mot***");
  await waitFor(() => expect(view.hasFocus).toBe(true));
  edit({ selection: { anchor: view.state.doc.length } });
  await press(within(toolbar).getByRole("button", { name: "Bloc de code" }));
  await choose("ts");
  expect(text()).toBe("## un ***mot***\n```ts\n\n```");
  edit({ changes: { from: 0, to: view.state.doc.length, insert: "a b" }, selection: { anchor: 2, head: 3 } });
  expect(shortcut("b")).toBe(true);
  expect(text()).toBe("a **b**");
  expect(shortcut("i")).toBe(true);
  expect(text()).toBe("a ***b***");
  expect(shortcut("e")).toBe(true);
  expect(text()).toBe("a ***`b`***");
});

const withFocus = (view: EditorView) => {
  let focused = false;
  Object.defineProperty(view, "hasFocus", { configurable: true, get: () => focused });
  view.focus = () => {
    focused = true;
  };
  return (next: boolean) => {
    focused = next;
    view.dispatch({});
  };
};

test("a bubble menu shows on a focused non-empty selection, survives its own clicks and hides on blur", async () => {
  setup("view");
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Modifier" }));
  const { view, press, edit } = await blurredEditor();
  const setFocus = withFocus(view);
  const bubbleName = { name: "Mise en forme de la sélection" };
  const bubbleShown = () => screen.queryByRole("toolbar", bubbleName) !== null;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  edit({ changes: { from: 0, to: view.state.doc.length, insert: "un mot" }, selection: { anchor: 0 } });
  setFocus(true);
  await settle();
  expect(bubbleShown()).toBe(false);
  setFocus(false);
  edit({ selection: { anchor: 3, head: 6 } });
  await settle();
  expect(bubbleShown()).toBe(false);
  setFocus(true);
  const bubble = await screen.findByRole("toolbar", bubbleName);
  const strike = within(bubble).getByRole("button", { name: "Barré" });
  const down = createEvent.mouseDown(strike);
  fireEvent(strike, down);
  expect(down.defaultPrevented).toBe(true);
  await press(strike);
  expect(view.state.doc.toString()).toBe("un ~~mot~~");
  await settle();
  expect(bubbleShown()).toBe(true);
  setFocus(false);
  await waitFor(() => expect(bubbleShown()).toBe(false));
});

test("typing / at the start of a line opens the block menu, filtered and applied", async () => {
  setup("view");
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.focus();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  view.dispatch({ changes: { from: 0, insert: "/" }, selection: { anchor: 1 }, userEvent: "input.type" });
  await waitFor(() =>
    expect(currentCompletions(view.state).map((c) => c.label)).toEqual([
      "Titre 1",
      "Titre 2",
      "Titre 3",
      "Liste",
      "Liste numérotée",
      "Case à cocher",
      "Citation",
      "Bloc de code",
      "Tableau",
      "Lien",
      "Image",
    ]),
  );
  view.dispatch({ changes: { from: 1, insert: "tab" }, selection: { anchor: 4 }, userEvent: "input.type" });
  await waitFor(() => expect(currentCompletions(view.state).map((c) => c.label)).toEqual(["Tableau"]));
  await waitFor(() => expect(acceptCompletion(view)).toBe(true));
  expect(view.state.doc.toString()).toBe(
    "| Colonne 1 | Colonne 2 | Colonne 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |",
  );
});

test("live preview hides the marks away from the cursor and a checkbox toggles its task", async () => {
  setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: "# Titre\n\n- [ ] faire\n\n**gras**" },
    selection: { anchor: 0 },
  });
  await waitFor(() => expect(view.contentDOM.textContent).not.toContain("**"));
  expect(view.contentDOM.textContent).toContain("# Titre");
  const box = await screen.findByRole("checkbox", { name: "Case à cocher, non cochée" });
  fireEvent.mouseDown(box);
  expect(view.state.doc.toString()).toContain("- [x] faire");
  view.dispatch({ selection: { anchor: view.state.doc.length } });
  await waitFor(() => expect(view.contentDOM.textContent).toContain("**gras**"));
  expect(view.contentDOM.textContent).not.toContain("# ");
});

test("a focused checkbox toggles its task in the document with Space and Enter", async () => {
  setup("view");
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: "- [ ] faire\n\nfin" },
    selection: { anchor: 13 },
  });
  const todo = await screen.findByRole("checkbox", { name: "Case à cocher, non cochée" });
  todo.focus();
  expect(fireEvent.keyDown(todo, { key: " " })).toBe(false);
  expect(view.state.doc.toString()).toBe("- [x] faire\n\nfin");
  const done = await screen.findByRole("checkbox", { name: "Case à cocher, cochée" });
  done.focus();
  expect(fireEvent.keyDown(done, { key: "Enter" })).toBe(false);
  expect(view.state.doc.toString()).toBe("- [ ] faire\n\nfin");
  const again = await screen.findByRole("checkbox", { name: "Case à cocher, non cochée" });
  expect(fireEvent.click(again)).toBe(false);
  expect(view.state.doc.toString()).toBe("- [ ] faire\n\nfin");
});
