import { expect, test } from "bun:test";
import { EditorView } from "@codemirror/view";
import { act, render } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";

const noop = () => {};

const views = () =>
  Array.from(document.querySelectorAll(".cm-editor")).flatMap((dom) => {
    const view = dom instanceof HTMLElement ? EditorView.findFromDOM(dom) : null;
    return view ? [view] : [];
  });

test("the split layout shows a read-only original beside the editable file", () => {
  render(
    <CodeEditor
      initial={"b\n"}
      original={"a\n"}
      path="x.ts"
      layout="split"
      label="x.ts"
      onChange={noop}
      onSave={noop}
    />,
  );
  expect(views().map((v) => [v.state.doc.toString(), v.state.readOnly])).toEqual([
    ["a\n", true],
    ["b\n", false],
  ]);
});

test("the unified layout keeps a single editable view", () => {
  render(
    <CodeEditor
      initial={"b\n"}
      original={"a\n"}
      path="x.ts"
      layout="unified"
      label="x.ts"
      onChange={noop}
      onSave={noop}
    />,
  );
  expect(views().map((v) => v.state.doc.toString())).toEqual(["b\n"]);
});

test("edits are reported and the editor follows the dark theme", async () => {
  const changes: string[] = [];
  render(
    <CodeEditor
      initial="a"
      original={null}
      path="x.ts"
      layout="single"
      label="x.ts"
      onChange={(v) => changes.push(v)}
      onSave={noop}
    />,
  );
  const [view] = views();
  if (!view) throw new Error("editor not mounted");
  act(() => view.dispatch({ changes: { from: 1, insert: "b" } }));
  expect(changes).toEqual(["ab"]);
  expect(view.state.facet(EditorView.darkTheme)).toBe(false);
  await act(async () => {
    document.documentElement.classList.add("dark");
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(view.state.facet(EditorView.darkTheme)).toBe(true);
  document.documentElement.classList.remove("dark");
});
