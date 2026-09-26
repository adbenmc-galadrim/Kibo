import type { TabTarget } from "@kibo/schema";
import { useSyncExternalStore } from "react";
import { hashToTarget, targetToHash } from "./tabs/target-hash";

export type Screen = "agents" | "queue" | "domains";
export type Route = {
  projectId: string | null;
  pageId: string | null;
  target: TabTarget | null;
  screen: Screen | null;
};

const SCREENS: [Screen, string][] = [
  ["agents", "#/agents"],
  ["queue", "#/agents/queue"],
  ["domains", "#/settings/domains"],
];

export function parseRoute(hash: string): Route {
  const screen = SCREENS.find(([, h]) => h === hash.replace(/\/$/, ""))?.[0];
  if (screen) return { projectId: null, pageId: null, target: null, screen };
  const target = hashToTarget(hash);
  return {
    projectId: target?.projectId ?? null,
    pageId: target?.kind === "page" ? target.pageId : null,
    target,
    screen: null,
  };
}

let lastHash = location.hash;
let current = parseRoute(lastHash);

function snapshot(): Route {
  if (location.hash !== lastHash) {
    lastHash = location.hash;
    current = parseRoute(lastHash);
  }
  return current;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot);
}

export function navigateTo(target: TabTarget | null): void {
  location.hash = targetToHash(target);
}

export function navigate(projectId: string | null, pageId: string | null = null): void {
  navigateTo(
    projectId ? (pageId ? { kind: "page", projectId, pageId } : { kind: "project", projectId }) : null,
  );
}

export function openScreen(screen: Screen): void {
  location.hash = SCREENS.find(([s]) => s === screen)?.[1] ?? "#/";
}
