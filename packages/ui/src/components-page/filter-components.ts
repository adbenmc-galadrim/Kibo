import { type ComponentOrigin, compareSemver } from "@kibo/schema";
import type { ComponentRow } from "./rows";

export type TrustFilter = "all" | "trusted" | "sandboxed" | "pending";
export type OriginFilter = "all" | ComponentOrigin;
export type SortKey = "title" | "version" | "trust" | "origin" | "usage";
export type ComponentsQuery = {
  text: string;
  trust: TrustFilter;
  origin: OriginFilter;
  sort: SortKey;
  descending: boolean;
};

export const DEFAULT_QUERY: ComponentsQuery = {
  text: "",
  trust: "all",
  origin: "all",
  sort: "title",
  descending: false,
};

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const byText = (a: string, b: string) => a.localeCompare(b, "fr");

const TRUST_ORDER: readonly ComponentRow["trust"][] = ["builtin", "trusted", "sandboxed", "pending"];
const ORIGIN_ORDER: readonly ComponentOrigin[] = ["kibo", "user", "ai", "marketplace"];

const COMPARE: Record<SortKey, (a: ComponentRow, b: ComponentRow) => number> = {
  title: (a, b) => byText(a.title, b.title),
  version: (a, b) => compareSemver(a.version, b.version),
  trust: (a, b) => TRUST_ORDER.indexOf(a.trust) - TRUST_ORDER.indexOf(b.trust),
  origin: (a, b) => ORIGIN_ORDER.indexOf(a.origin) - ORIGIN_ORDER.indexOf(b.origin),
  usage: (a, b) => a.pages - b.pages,
};

const trustMatches = (row: ComponentRow, filter: TrustFilter) =>
  filter === "all" || row.trust === filter || (filter === "trusted" && row.trust === "builtin");

export function filterComponents(rows: readonly ComponentRow[], query: ComponentsQuery): ComponentRow[] {
  const needle = normalize(query.text.trim());
  const direction = query.descending ? -1 : 1;
  const compare = COMPARE[query.sort];
  return rows
    .filter((r) => !needle || normalize(r.title).includes(needle) || normalize(r.id).includes(needle))
    .filter((r) => trustMatches(r, query.trust))
    .filter((r) => query.origin === "all" || r.origin === query.origin)
    .sort(
      (a, b) => direction * compare(a, b) || byText(a.title, b.title) || compareSemver(b.version, a.version),
    );
}

export const toggleSort = (q: ComponentsQuery, key: SortKey): ComponentsQuery =>
  q.sort === key ? { ...q, descending: !q.descending } : { ...q, sort: key, descending: key === "usage" };
