import type { Page } from "@kibo/schema";
import { descendantIds } from "./page-menu";

export type DropZone = { kind: "root" } | { kind: "before" | "inside" | "after"; pageId: string };
export type PageMove = { pageId: string; parentId: string | null; index?: number };

const ROOT = "root";
const KINDS = ["before", "inside", "after"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (s: string): s is Kind => KINDS.some((k) => k === s);

export function zoneId(zone: DropZone): string {
  return zone.kind === "root" ? ROOT : `${zone.pageId}:${zone.kind}`;
}

export function parseZoneId(id: string): DropZone | null {
  if (id === ROOT) return { kind: "root" };
  const at = id.lastIndexOf(":");
  const pageId = id.slice(0, at);
  const kind = id.slice(at + 1);
  return at > 0 && isKind(kind) ? { kind, pageId } : null;
}

export function pageDropPlan(pages: readonly Page[], activeId: string, zone: DropZone): PageMove | null {
  const active = pages.find((p) => p.id === activeId);
  if (!active) return null;
  if (zone.kind === "root") return active.parentId === null ? null : { pageId: activeId, parentId: null };
  const target = pages.find((p) => p.id === zone.pageId);
  if (!target || target.id === activeId || descendantIds(pages, activeId).has(target.id)) return null;
  if (zone.kind === "inside") {
    return active.parentId === target.id ? null : { pageId: activeId, parentId: target.id };
  }
  const parentId = target.parentId;
  const siblings = pages.filter((p) => p.parentId === parentId && p.id !== activeId);
  const at = siblings.findIndex((p) => p.id === target.id);
  const index = zone.kind === "before" ? at : at + 1;
  const current = pages.filter((p) => p.parentId === parentId).findIndex((p) => p.id === activeId);
  if (active.parentId === parentId && current === index) return null;
  return { pageId: activeId, parentId, index };
}
