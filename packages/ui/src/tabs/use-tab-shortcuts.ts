import { useEffect, useRef } from "react";

export type TabShortcut =
  | { kind: "newTab" }
  | { kind: "palette" }
  | { kind: "close" }
  | { kind: "togglePin" }
  | { kind: "reopen" }
  | { kind: "help" }
  | { kind: "projectAgent" }
  | { kind: "activate"; index: number };
type KeyInput = { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };

export const isMacPlatform = (platform: string): boolean => /mac|iphone|ipad/i.test(platform);

export function shortcutFor(e: KeyInput, mac: boolean): TabShortcut | null {
  const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!mod || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (key === "/") return { kind: "help" };
  if (e.shiftKey) return key === "p" ? { kind: "togglePin" } : key === "t" ? { kind: "reopen" } : null;
  if (key === "t") return { kind: "newTab" };
  if (key === "k") return { kind: "palette" };
  if (key === "w") return { kind: "close" };
  if (key === "j") return { kind: "projectAgent" };
  if (/^[1-9]$/.test(key)) return { kind: "activate", index: Number(key) - 1 };
  return null;
}

export function useTabShortcuts(onShortcut: (s: TabShortcut) => void): void {
  const handler = useRef(onShortcut);
  handler.current = onShortcut;
  useEffect(() => {
    const mac = isMacPlatform(navigator.platform);
    const listener = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e, mac);
      if (!shortcut) return;
      e.preventDefault();
      handler.current(shortcut);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
