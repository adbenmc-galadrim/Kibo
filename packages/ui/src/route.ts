import { useSyncExternalStore } from "react";

export type Screen = "agents" | "queue" | "domains";
export type Route = { projectId: string | null; pageId: string | null; screen: Screen | null };

const SCREENS: [Screen, string][] = [
  ["agents", "#/agents"],
  ["queue", "#/agents/queue"],
  ["domains", "#/settings/domains"],
];

export function parseRoute(hash: string): Route {
  const screen = SCREENS.find(([, h]) => h === hash.replace(/\/$/, ""))?.[0];
  if (screen) return { projectId: null, pageId: null, screen };
  const m = /^#\/p\/([^/]+)(?:\/([^/]+))?/.exec(hash);
  return { projectId: m?.[1] ?? null, pageId: m?.[2] ? decodeURIComponent(m[2]) : null, screen: null };
}

let current = parseRoute(location.hash);
const subscribe = (cb: () => void) => {
  const on = () => {
    current = parseRoute(location.hash);
    cb();
  };
  window.addEventListener("hashchange", on);
  return () => window.removeEventListener("hashchange", on);
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current);
}

export function navigate(projectId: string | null, pageId: string | null = null): void {
  location.hash = projectId ? `#/p/${projectId}/${pageId ? encodeURIComponent(pageId) : ""}` : "#/";
}

export function openScreen(screen: Screen): void {
  location.hash = SCREENS.find(([s]) => s === screen)?.[1] ?? "#/";
}
