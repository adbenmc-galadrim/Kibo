import { expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { editorView, setup } from "./notes.test-helper";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const pasteFile = (target: Element, file: File) => {
  const data = new DataTransfer();
  data.items.add(file);
  const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

test("a pasted image is saved under assets/, inserted at the cursor and shown in the preview", async () => {
  const m = setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  view.dispatch({ selection: { anchor: view.state.doc.length } });
  const event = pasteFile(view.contentDOM, new File([PNG], "capture.png", { type: "image/png" }));
  expect(event.defaultPrevented).toBe(true);
  await waitFor(() =>
    expect(view.state.doc.toString()).toMatch(/!\[\]\(assets\/decisions-architecture-\d{8}-\d{6}\.png\)$/),
  );
  const path = /assets\/[^)]+/.exec(view.state.doc.toString())?.[0] ?? "";
  expect([...(await m.sdk.notes.asset(path)).bytes]).toEqual([...PNG]);
  await user.click(screen.getByRole("button", { name: "Aperçu" }));
  const image = await waitFor(() => {
    const img = screen.getByRole("article").querySelector<HTMLImageElement>(`img[data-asset="${path}"]`);
    expect(img?.getAttribute("src")).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    return img;
  });
  await user.type(screen.getByPlaceholderText("Rechercher une note…"), "d");
  expect(image?.isConnected).toBe(true);
  expect(image?.getAttribute("src")).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
});

test("a pasted image that is not an image type is left to the editor, a refused one shows an error", async () => {
  setup("view");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1, name: "Décisions d'architecture" });
  await user.click(screen.getByRole("button", { name: "Modifier" }));
  const view = await editorView();
  const before = view.state.doc.toString();
  pasteFile(view.contentDOM, new File(["x"], "a.svg", { type: "image/svg+xml" }));
  expect(view.state.doc.toString()).toBe(before);
  pasteFile(view.contentDOM, new File(["<html>"], "a.png", { type: "image/png" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'enregistrer l'image.");
  expect(view.state.doc.toString()).toBe(before);
});
