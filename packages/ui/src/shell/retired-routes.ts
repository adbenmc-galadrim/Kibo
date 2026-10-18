import { hashToTarget } from "../tabs/target-hash";
import { isRetiredTarget } from "./nav/execution-visibility";

export { isRetiredScreen, isRetiredTarget } from "./nav/execution-visibility";

export type RetiredRoute = { kind: "home" };

const HOME: RetiredRoute = { kind: "home" };

const RETIRED_ROUTES: readonly string[] = [
  "/agents",
  "/queue",
  "/skills",
  "/creations",
  "/components",
  "/settings/sources",
  "/settings/components",
  "/settings/domains",
  "/code",
];

const pathOf = (hash: string): string => (hash.replace(/^#/, "").split("?")[0] ?? "").replace(/\/$/, "");

export function retiredRoute(hash: string): RetiredRoute | null {
  const path = pathOf(hash);
  if (RETIRED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return HOME;
  const target = hashToTarget(hash);
  return target !== null && isRetiredTarget(target) ? HOME : null;
}
