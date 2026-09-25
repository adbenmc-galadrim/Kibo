import { useSyncExternalStore } from "react";

export type Route = { projectId: string | null; pageId: string | null };

function parse(hash: string): Route {
  const m = /^#\/p\/([^/]+)(?:\/([^/]+))?/.exec(hash);
  return { projectId: m?.[1] ?? null, pageId: m?.[2] ? decodeURIComponent(m[2]) : null };
}

let current = parse(location.hash);
const subscribe = (cb: () => void) => {
  const on = () => {
    current = parse(location.hash);
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
