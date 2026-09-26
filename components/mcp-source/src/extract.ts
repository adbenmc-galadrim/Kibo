import { type McpCallResult, WebUrl } from "@kibo/schema";
import type { McpSourceConfig } from "./config";

export const MAX_ITEMS = 200;
export type SourceItem = { id: string; title: string; subtitle: string | null; url: string | null };
export type ExtractError = "empty" | "not-json" | "not-a-list";

const unescapeToken = (token: string) => token.replaceAll("~1", "/").replaceAll("~0", "~");

export function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  let cur: unknown = doc;
  for (const token of pointer.slice(1).split("/").map(unescapeToken)) {
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
      cur = cur[Number(token)];
    } else if (typeof cur === "object" && cur !== null && Object.hasOwn(cur, token)) {
      cur = (cur as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return cur;
}

const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null;

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export function extractItems(
  result: McpCallResult,
  mapping: McpSourceConfig["mapping"],
): { items: SourceItem[]; error: ExtractError | null } {
  const raw = result.content.find((c) => c.type === "text");
  if (!raw || raw.type !== "text") return { items: [], error: "empty" };
  const doc = parseJson(raw.text);
  if (!doc.ok) return { items: [], error: "not-json" };
  const list = resolvePointer(doc.value, mapping.items);
  if (!Array.isArray(list)) return { items: [], error: "not-a-list" };
  const items = list.slice(0, MAX_ITEMS).flatMap((entry): SourceItem[] => {
    const id = text(resolvePointer(entry, mapping.id));
    const title = text(resolvePointer(entry, mapping.title));
    if (id === null || title === null) return [];
    const url = WebUrl.safeParse(mapping.url ? resolvePointer(entry, mapping.url) : undefined);
    return [
      {
        id: id.slice(0, 256),
        title: title.slice(0, 500),
        subtitle: mapping.subtitle ? text(resolvePointer(entry, mapping.subtitle)) : null,
        url: url.success ? url.data : null,
      },
    ];
  });
  return { items, error: null };
}
