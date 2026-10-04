import { expect, test } from "bun:test";
import { dialogOpen, focusReducer } from "./focus-mode";

test("focus reducer: one widget at a time, escape exits only without an open dialog", () => {
  expect(focusReducer(null, { type: "request", id: "a", allowed: true })).toBe("a");
  expect(focusReducer(null, { type: "request", id: "a", allowed: false })).toBeNull();
  expect(focusReducer("a", { type: "request", id: "b", allowed: false })).toBe("a");
  expect(focusReducer("a", { type: "request", id: "b", allowed: true })).toBe("b");
  expect(focusReducer("a", { type: "escape", dialogOpen: true })).toBe("a");
  expect(focusReducer("a", { type: "escape", dialogOpen: false })).toBeNull();
  expect(focusReducer("a", { type: "exit", id: "b" })).toBe("a");
  expect(focusReducer("a", { type: "exit", id: "a" })).toBeNull();
});

test("an open dialog is one radix marks as open", () => {
  document.body.innerHTML =
    '<div role="dialog" aria-modal="true"></div><div role="dialog" data-state="closed"></div>';
  expect(dialogOpen()).toBe(false);
  document.body.insertAdjacentHTML("beforeend", '<div role="alertdialog" data-state="open"></div>');
  expect(dialogOpen()).toBe(true);
  document.body.innerHTML = "";
});
