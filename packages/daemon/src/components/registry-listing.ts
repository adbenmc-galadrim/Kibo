import { listInstances, listPages, readRegistry } from "@kibo/core";
import {
  BUILTIN_IDS,
  type ComponentSummary,
  type ComponentUsage,
  type ComponentVersionSummary,
  compareSemver,
  formatRef,
  isActive,
  type PublishUsage,
  type RegistryEntry,
  splitRef,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { ComponentStore } from "./store";

export type ProjectRef = { id: string; name: string; doc: LoroDoc };

export function findUsages(projects: ProjectRef[], id: string, version?: string): PublishUsage[] {
  return projects.flatMap((p) => {
    const pages = listPages(p.doc);
    return listInstances(p.doc).flatMap((i) => {
      const ref = splitRef(i.component);
      if (ref.id !== id || (version !== undefined && ref.version !== version)) return [];
      return [
        {
          projectId: p.id,
          projectName: p.name,
          pageId: i.pageId,
          pageTitle: pages.find((pg) => pg.id === i.pageId)?.title ?? "",
          instanceId: i.id,
          version: ref.version,
        },
      ];
    });
  });
}

export const withoutVersion = ({ version: _version, ...usage }: PublishUsage): ComponentUsage => usage;

function builtinSummary(projects: ProjectRef[], id: string): ComponentSummary {
  const byVersion = new Map<string, ComponentUsage[]>();
  for (const u of findUsages(projects, id)) {
    byVersion.set(u.version, [...(byVersion.get(u.version) ?? []), withoutVersion(u)]);
  }
  return {
    id,
    title: id,
    builtin: true,
    versions: [...byVersion].map(
      ([version, usages]): ComponentVersionSummary => ({
        version,
        hash: null,
        trust: "builtin",
        origin: "kibo",
        active: true,
        tampered: false,
        manifest: null,
        usages,
        revoked: null,
        backend: false,
      }),
    ),
  };
}

type InstalledContext = {
  projects: ProjectRef[];
  store: Pick<ComponentStore, "get">;
  isTampered(ref: string): boolean;
};

function installedSummary(ctx: InstalledContext, id: string, entry: RegistryEntry): ComponentSummary {
  const versions = Object.values(entry.versions)
    .sort((a, b) => compareSemver(a.version, b.version))
    .map((v): ComponentVersionSummary => {
      const tampered = ctx.isTampered(formatRef(id, v.version));
      const stored = ctx.store.get(id, v.version);
      return {
        version: v.version,
        hash: v.hash,
        trust: v.trust,
        origin: v.origin,
        active: isActive(v) && !tampered,
        tampered,
        manifest: stored?.manifest ?? null,
        usages: findUsages(ctx.projects, id, v.version).map(withoutVersion),
        revoked: v.revoked ?? null,
        backend: stored?.build["server.js"] !== undefined,
      };
    });
  return { id, title: entry.title, builtin: false, versions };
}

export function listComponents(ws: LoroDoc, ctx: InstalledContext): ComponentSummary[] {
  const builtins = BUILTIN_IDS.map((id) => builtinSummary(ctx.projects, id));
  const installed = Object.entries(readRegistry(ws))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => installedSummary(ctx, id, entry));
  return [...builtins, ...installed];
}
