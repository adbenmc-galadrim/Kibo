import { afterEach, expect, test } from "bun:test";
import { allowsNativeMenu, blockNativeContextMenu } from "./native-context-menu";

afterEach(() => {
  document.body.replaceChildren();
});

test("the native menu stays in text fields, editable areas and on a selection", () => {
  expect(allowsNativeMenu(document.createElement("input"), "")).toBe(true);
  expect(allowsNativeMenu(document.createElement("textarea"), "")).toBe(true);
  const editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  const inner = document.createElement("span");
  editable.appendChild(inner);
  document.body.appendChild(editable);
  expect(allowsNativeMenu(inner, "")).toBe(true);
  expect(allowsNativeMenu(document.createElement("div"), "du texte")).toBe(true);
  expect(allowsNativeMenu(document.createElement("div"), "   ")).toBe(false);
  expect(allowsNativeMenu(document.createElement("button"), "")).toBe(false);
  expect(allowsNativeMenu(null, "")).toBe(false);
});

test("contextmenu is prevented on the chrome and left alone in a field", () => {
  let selection = "";
  const off = blockNativeContextMenu(document, () => selection);
  const button = document.createElement("button");
  document.body.appendChild(button);
  const blocked = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(blocked);
  expect(blocked.defaultPrevented).toBe(true);
  const input = document.createElement("input");
  document.body.appendChild(input);
  const allowed = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  input.dispatchEvent(allowed);
  expect(allowed.defaultPrevented).toBe(false);
  selection = "mot";
  const withSelection = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(withSelection);
  expect(withSelection.defaultPrevented).toBe(false);
  off();
  const after = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  selection = "";
  button.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
