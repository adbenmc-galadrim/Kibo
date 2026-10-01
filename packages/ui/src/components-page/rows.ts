import {
  type ComponentOrigin,
  type ComponentSummary,
  type ComponentUsage,
  type ComponentVersionSummary,
  compareSemver,
  type MarketComponentStatus,
} from "@kibo/schema";
import { BUILTIN_COMPONENTS } from "../registry";

export type RowTrust = "builtin" | "trusted" | "sandboxed" | "pending";

export type ComponentRow = {
  key: string;
  id: string;
  title: string;
  version: string;
  builtin: boolean;
  trust: RowTrust;
  tampered: boolean;
  origin: ComponentOrigin;
  pages: number;
  projects: number;
  used: boolean;
  usages: ComponentUsage[];
  summary: ComponentVersionSummary | null;
  revoked: ComponentVersionSummary["revoked"];
  market: MarketComponentStatus | null;
};

const counts = (usages: ComponentUsage[]) => ({
  usages,
  pages: new Set(usages.map((u) => `${u.projectId}/${u.pageId}`)).size,
  projects: new Set(usages.map((u) => u.projectId)).size,
  used: usages.length > 0,
});

const trustOf = (v: ComponentVersionSummary): RowTrust =>
  v.active && (v.trust === "trusted" || v.trust === "sandboxed") ? v.trust : "pending";

function builtinRows(components: ComponentSummary[]): ComponentRow[] {
  return BUILTIN_COMPONENTS.map(({ manifest: m }) => {
    const usages =
      components.find((c) => c.builtin && c.id === m.id)?.versions.flatMap((v) => v.usages) ?? [];
    return {
      key: m.id,
      id: m.id,
      title: m.title,
      version: m.version,
      builtin: true,
      trust: "builtin",
      tampered: false,
      origin: "kibo",
      ...counts(usages),
      summary: null,
      revoked: null,
      market: null,
    };
  });
}

function installedRows(components: ComponentSummary[], statuses: MarketComponentStatus[]): ComponentRow[] {
  return components
    .filter((c) => !c.builtin)
    .flatMap((c) =>
      c.versions.map((v) => ({
        key: `${c.id}@${v.version}`,
        id: c.id,
        title: c.title,
        version: v.version,
        builtin: false,
        trust: trustOf(v),
        tampered: v.tampered,
        origin: v.origin,
        ...counts(v.usages),
        summary: v,
        revoked: v.revoked,
        market: statuses.find((s) => s.id === c.id && s.version === v.version) ?? null,
      })),
    );
}

export function componentRows(
  components: ComponentSummary[],
  statuses: MarketComponentStatus[] = [],
): ComponentRow[] {
  return [...builtinRows(components), ...installedRows(components, statuses)].sort(
    (a, b) => a.title.localeCompare(b.title, "fr") || compareSemver(b.version, a.version),
  );
}

export const modifiable = (origin: string): origin is "user" | "ai" => origin === "user" || origin === "ai";
