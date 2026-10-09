import type { TabTarget } from "@kibo/schema";
import { useSyncExternalStore } from "react";
import { hashToTarget, targetToHash } from "./tabs/target-hash";

export type Route = {
  projectId: string | null;
  pageId: string | null;
  target: TabTarget | null;
};

export function parseRoute(hash: string): Route {
  const target = hashToTarget(hash);
  return {
    projectId: target && target.kind !== "screen" ? target.projectId : null,
    pageId: target?.kind === "page" ? target.pageId : null,
    target,
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

export function replaceRoute(target: TabTarget | null): void {
  history.replaceState(history.state, "", targetToHash(target));
}

export function navigate(projectId: string | null, pageId: string | null = null): void {
  navigateTo(
    projectId ? (pageId ? { kind: "page", projectId, pageId } : { kind: "project", projectId }) : null,
  );
}
