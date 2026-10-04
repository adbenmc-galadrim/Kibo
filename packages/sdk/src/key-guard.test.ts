import { afterEach, expect, test } from "bun:test";
import { guardDestructiveKeys, isDestructiveKey, isEditableTarget } from "./key-guard";

let stop = () => {};
afterEach(() => {
  stop();
  document.body.innerHTML = "";
});

const press = (target: EventTarget, key: string, init: KeyboardEventInit = {}): boolean => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

test("Backspace and Delete outside an editable field are neutralized", () => {
  stop = guardDestructiveKeys();
  document.body.innerHTML = '<main><button id="b">x</button></main>';
  const button = document.getElementById("b") ?? document.body;
  expect(press(button, "Backspace")).toBe(true);
  expect(press(button, "Delete")).toBe(true);
  expect(press(document.body, "Backspace")).toBe(true);
});

test("inside an input, a textarea, a contenteditable or the CodeMirror content, nothing is prevented", () => {
  stop = guardDestructiveKeys();
  document.body.innerHTML =
    '<input id="i"><textarea id="t"></textarea><div id="c" contenteditable="true"></div><div class="cm-content" contenteditable="true"><div id="line">a</div></div>';
  for (const id of ["i", "t", "c", "line"]) {
    const el = document.getElementById(id);
    if (!el) throw new Error(id);
    expect(press(el, "Backspace")).toBe(false);
    expect(press(el, "Delete")).toBe(false);
  }
});

test("a modifier or another key is never touched", () => {
  stop = guardDestructiveKeys();
  expect(press(document.body, "Backspace", { metaKey: true })).toBe(false);
  expect(press(document.body, "Delete", { ctrlKey: true })).toBe(false);
  expect(press(document.body, "Backspace", { altKey: true })).toBe(false);
  expect(press(document.body, "Escape")).toBe(false);
  expect(press(document.body, "w", { metaKey: true })).toBe(false);
});

test("the predicates are pure", () => {
  expect(isDestructiveKey({ key: "Delete", metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
  expect(isDestructiveKey({ key: "a", metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
  expect(isEditableTarget(null)).toBe(false);
});
