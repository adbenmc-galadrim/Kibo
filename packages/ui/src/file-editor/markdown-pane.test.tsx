import { expect, mock, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownPane, type PaneMode } from "./MarkdownPane";

const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });

const show = (mode: PaneMode, extra: { original?: string | null; readOnly?: boolean } = {}) => {
  const onMode = mock((_: PaneMode) => {});
  render(
    <MarkdownPane
      value={"# Titre\n\nTexte `code`.\n"}
      onChange={() => {}}
      mode={mode}
      onMode={onMode}
      label="Spec de livraison"
      {...extra}
    />,
  );
  return onMode;
};

test("edit mode shows only the editor", () => {
  show("edit");
  expect(views().map((v) => v.state.doc.toString())).toEqual(["# Titre\n\nTexte `code`.\n"]);
  expect(screen.queryByTestId("markdown-preview")).toBeNull();
});

test("preview mode renders the markdown without an editor", () => {
  show("preview");
  expect(views()).toEqual([]);
  const preview = screen.getByTestId("markdown-preview");
  expect(preview.querySelector("p.font-medium")?.textContent).toBe("Titre");
  expect(preview.querySelector("code")?.textContent).toBe("code");
});

test("split mode shows the editor beside the preview, and the modes switch", async () => {
  const onMode = show("split");
  expect(views()).toHaveLength(1);
  expect(screen.getByTestId("markdown-preview")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("radio", { name: "Aperçu" }));
  expect(onMode).toHaveBeenCalledWith("preview");
});

test("an original turns the editor into a side by side diff", () => {
  show("edit", { original: "# Ancien\n" });
  expect(views().map((v) => [v.state.doc.toString(), v.state.readOnly])).toEqual([
    ["# Ancien\n", true],
    ["# Titre\n\nTexte `code`.\n", false],
  ]);
});

test("a read-only pane never lets the text change", () => {
  show("edit", { readOnly: true });
  expect(views().map((v) => v.state.readOnly)).toEqual([true]);
});
