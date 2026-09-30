import { isMacPlatform } from "../tabs/use-tab-shortcuts";

const MAC_KEYS: Record<string, string> = { Shift: "⇧", Alt: "⌥", Ctrl: "⌃" };

export const isMac = (): boolean => isMacPlatform(navigator.platform);

export function shortcutLabel(keys: readonly string[], mac: boolean): string {
  if (mac) return `⌘${keys.map((k) => MAC_KEYS[k] ?? k).join("")}`;
  return ["Ctrl", ...keys].join("+");
}
