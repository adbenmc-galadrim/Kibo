import type { ProjectDelivery, WorktreeRecipe, WorktreeSettings } from "@kibo/schema";
import { frDeliverySettings } from "../i18n/fr-delivery-settings";
import { abbreviateHome } from "../lib/home-path";

export type ImportSide = { worktree: WorktreeSettings | null; delivery: ProjectDelivery | null };
export type ImportRow = { label: string; before: string; after: string };

const t = frDeliverySettings.import;
const PATHS = ["root", "profile", "memory", "briefs", "reports", "todo"] as const;

export function recipeSummary(recipe: WorktreeRecipe | null): string {
  if (recipe === null) return t.none;
  const ports = Object.keys(recipe.env?.ports?.keys ?? {});
  const parts = [
    recipe.copy.length > 0 ? t.copied(recipe.copy) : null,
    ports.length > 0 ? ports.join(", ") : null,
    recipe.after.length > 0 ? recipe.after.join(" ; ") : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? t.none : parts.join(" · ");
}

const path = (value: string | null | undefined): string => (value ? abbreviateHome(value) : t.empty);
const list = (items: readonly string[] | undefined): string =>
  items && items.length > 0 ? items.map(abbreviateHome).join(", ") : t.none;

function sideOf(side: ImportSide): Record<string, string> {
  const d = side.delivery;
  const publication = d?.publication;
  return {
    baseRef: side.worktree?.baseRef ?? t.empty,
    pathTemplate: side.worktree?.pathTemplate ?? t.empty,
    recipe: recipeSummary(side.worktree?.recipe ?? null),
    ...Object.fromEntries(PATHS.map((key) => [key, path(d?.[key])])),
    idPattern: d?.idPattern ?? t.empty,
    publication: publication ? frDeliverySettings.section.publications[publication] : t.empty,
    allow: d && d.allow.length > 0 ? t.rules(d.allow.length) : t.none,
    addDirs: list(d?.addDirs),
  };
}

export function importRows(before: ImportSide, after: ImportSide): ImportRow[] {
  const from = sideOf(before);
  const to = sideOf(after);
  return Object.entries(t.rows).map(([key, label]) => ({
    label,
    before: from[key] ?? t.empty,
    after: to[key] ?? t.empty,
  }));
}
