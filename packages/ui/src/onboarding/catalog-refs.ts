import type { ComponentManifest } from "@kibo/schema";
import { useMemo } from "react";
import { BUILTIN_COMPONENTS } from "../registry";
import { useComponents } from "../state/use-components";

const NOT_A_STARTER = new Set(["mcp-source"]);
const STARTER_ORIGINS = new Set(["user", "ai"]);

const newer = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};

export function starterRefs(
  builtins: ComponentManifest[],
  installed: { id: string; version: string; active: boolean }[],
): Map<string, string> {
  const refs = new Map(
    builtins.filter((m) => !NOT_A_STARTER.has(m.id)).map((m) => [m.id, `${m.id}@${m.version}`] as const),
  );
  const best = new Map<string, string>();
  for (const c of installed) {
    if (!c.active || NOT_A_STARTER.has(c.id)) continue;
    const current = best.get(c.id);
    if (!current || newer(c.version, current)) best.set(c.id, c.version);
  }
  for (const [id, version] of best) if (!refs.has(id)) refs.set(id, `${id}@${version}`);
  return refs;
}

export function useStarterCatalog(): { refs: Map<string, string>; titles: Map<string, string> } {
  const { components } = useComponents();
  return useMemo(() => {
    const builtins = BUILTIN_COMPONENTS.map((c) => c.manifest);
    const users = (components ?? []).filter((c) => !c.builtin);
    const installed = users.flatMap((c) =>
      c.versions
        .filter((v) => STARTER_ORIGINS.has(v.origin))
        .map((v) => ({ id: c.id, version: v.version, active: v.active })),
    );
    const titles = new Map([
      ...builtins.map((m) => [m.id, m.title] as const),
      ...users.map((c) => [c.id, c.title] as const),
    ]);
    return { refs: starterRefs(builtins, installed), titles };
  }, [components]);
}
