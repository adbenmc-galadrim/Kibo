import type { Screen } from "@kibo/schema";
import { targetToHash } from "../tabs/target-hash";

export type RetiredRoute = { kind: "home" };

const HOME: RetiredRoute = { kind: "home" };

const RETIRED_ROUTES: readonly string[] = [
  "/agents",
  "/queue",
  "/skills",
  "/runs",
  "/creations",
  "/components",
  "/settings/sources",
  "/settings/components",
  "/settings/domains",
  "/settings/sync",
  "/settings/security",
  "/code",
];

const RETIRED_PROJECT_ROUTE = /^\/p\/[^/]+\/changes$/;

const pathOf = (hash: string): string => (hash.replace(/^#/, "").split("?")[0] ?? "").replace(/\/$/, "");

export function retiredRoute(hash: string): RetiredRoute | null {
  const path = pathOf(hash);
  if (RETIRED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return HOME;
  return RETIRED_PROJECT_ROUTE.test(path) ? HOME : null;
}

export const isRetiredScreen = (screen: Screen): boolean =>
  retiredRoute(targetToHash({ kind: "screen", screen })) !== null;
