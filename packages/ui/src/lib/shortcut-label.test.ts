import { expect, test } from "bun:test";
import { shortcutLabel } from "./shortcut-label";

test("mac shows symbols, others show Ctrl and plus signs", () => {
  expect(shortcutLabel(["K"], true)).toBe("⌘K");
  expect(shortcutLabel(["K"], false)).toBe("Ctrl+K");
  expect(shortcutLabel(["Shift", "P"], true)).toBe("⌘⇧P");
  expect(shortcutLabel(["Shift", "P"], false)).toBe("Ctrl+Shift+P");
  expect(shortcutLabel(["W"], true)).toBe("⌘W");
  expect(shortcutLabel(["1"], false)).toBe("Ctrl+1");
});
