import { expect, test } from "bun:test";
import { shortcutFor } from "./use-tab-shortcuts";

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

test("mod+/ asks for the shortcuts help, with ⌘ on macOS and Ctrl elsewhere", () => {
  expect(shortcutFor(key("/", { metaKey: true }), true)).toEqual({ kind: "help" });
  expect(shortcutFor(key("/", { ctrlKey: true }), true)).toBeNull();
  expect(shortcutFor(key("/", { ctrlKey: true }), false)).toEqual({ kind: "help" });
  expect(shortcutFor(key("/"), false)).toBeNull();
});

test("mod+/ still opens the help when the layout needs Shift to type a slash", () => {
  expect(shortcutFor(key("/", { metaKey: true, shiftKey: true }), true)).toEqual({ kind: "help" });
});

test("mod+J toggles the project agent panel, mod+shift+J does nothing", () => {
  expect(shortcutFor(key("j", { metaKey: true }), true)).toEqual({ kind: "projectAgent" });
  expect(shortcutFor(key("J", { ctrlKey: true }), false)).toEqual({ kind: "projectAgent" });
  expect(shortcutFor(key("j", { metaKey: true, shiftKey: true }), true)).toBeNull();
  expect(shortcutFor(key("j", { ctrlKey: true }), true)).toBeNull();
});
