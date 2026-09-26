import type { TabTarget } from "@kibo/schema";
import { useEffect, useRef } from "react";
import { navigateTo } from "../route";
import { activeTarget } from "./tabs-model";
import { targetToHash } from "./target-hash";
import type { TabsApi } from "./use-tabs";

export function useHashSync(tabs: TabsApi, routeTarget: TabTarget | null, onScreen = false): void {
  const active = activeTarget(tabs.state);
  const routeHash = targetToHash(routeTarget);
  const activeHash = targetToHash(active);
  const last = useRef<{ route: string; active: string } | null>(null);
  const { open } = tabs;
  useEffect(() => {
    const prev = last.current;
    last.current = { route: routeHash, active: activeHash };
    if (routeHash === activeHash) return;
    if (!prev) {
      if (routeTarget || onScreen) open(routeTarget);
      else navigateTo(active);
      return;
    }
    if (routeHash !== prev.route) open(routeTarget);
    else if (activeHash !== prev.active) navigateTo(active);
  }, [routeHash, activeHash, routeTarget, active, open, onScreen]);
}
