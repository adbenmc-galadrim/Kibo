import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type FigmaNodeRef,
  type FigmaPreview,
  type IntegrationStatus,
  KiboError,
  type KiboErrorCode,
  type McpCallResult,
} from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import { baseStatus } from "../integrations/probes";
import type { Settings } from "../integrations/settings";
import type { IntegrationHost } from "../integrations/types";
import type { McpHub } from "../mcp/hub";
import { nameFromMetadata, parseFigmaUrl } from "./figma-url";

export const FIGMA_TOOLS = ["get_metadata", "get_screenshot"] as const;
export const PREVIEW_TTL_MS = 7 * 24 * 3_600_000;
export const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const USER = { origin: "user", instanceId: null } as const;

type Deps = { host: IntegrationHost; hub: McpHub; settings: Settings; events: EventLog };
type CacheKey = { f: string; n: string };
type CacheRow = { png_path: string; fetched_at: number };
type Cached = { png: string; fetchedAt: number };

export type Figma = ReturnType<typeof createFigma>;

const isPng = (b: Buffer) => b.length <= MAX_PREVIEW_BYTES && PNG_SIGNATURE.every((v, i) => b[i] === v);
const asKibo = (e: unknown) => (e instanceof KiboError ? e : new KiboError("MCP_FAILED", String(e)));
const textOf = (r: McpCallResult) => r.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
const pngOf = (r: McpCallResult): Buffer | null => {
  for (const c of r.content)
    if (c.type === "image" && c.mimeType === "image/png") return Buffer.from(c.data, "base64");
  return null;
};
const fallback = (hit: Cached | null, reachable: boolean): FigmaPreview => ({
  png: hit?.png ?? null,
  fetchedAt: hit?.fetchedAt ?? null,
  reachable,
  available: hit !== null,
});

export function createFigma(deps: Deps) {
  const { host, hub, settings, events } = deps;
  let lastError: { code: KiboErrorCode; message: string } | null = null;
  const selectCache = host.db.query<CacheRow, CacheKey>(
    "SELECT png_path, fetched_at FROM figma_cache WHERE file_key = $f AND node_id = $n",
  );
  const upsertCache = host.db.query<null, CacheKey & { path: string; at: number }>(
    "INSERT INTO figma_cache (file_key, node_id, png_path, fetched_at) VALUES ($f, $n, $path, $at) ON CONFLICT(file_key, node_id) DO UPDATE SET png_path = excluded.png_path, fetched_at = excluded.fetched_at",
  );

  const configured = () => settings.get("figma.url") !== null;
  const toolNames = async () => (await hub.tools("figma")).map((t) => t.name);
  const checkTools = async () => {
    const names = await toolNames();
    const missing = FIGMA_TOOLS.filter((n) => !names.includes(n));
    if (missing.length > 0)
      throw new KiboError("MCP_FAILED", `figma server lacks tools: ${missing.join(", ")}`);
  };
  const status = (): IntegrationStatus => {
    if (!configured()) return baseStatus("figma", "disconnected");
    return lastError
      ? { ...baseStatus("figma", "error"), error: lastError }
      : baseStatus("figma", "connected");
  };
  const cached = (fileKey: string, nodeId: string): Cached | null => {
    const row = selectCache.get({ f: fileKey, n: nodeId });
    if (!row || !existsSync(row.png_path)) return null;
    return { png: readFileSync(row.png_path).toString("base64"), fetchedAt: row.fetched_at };
  };
  const store = (fileKey: string, nodeId: string, png: Buffer) => {
    const path = join(host.home, "cache", "figma", fileKey, `${nodeId.replace(":", "-")}.png`);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, png, { mode: 0o600 });
    chmodSync(path, 0o600);
    upsertCache.run({ f: fileKey, n: nodeId, path, at: host.now() });
  };
  const fetchPreview = async (fileKey: string, nodeId: string, hit: Cached | null): Promise<FigmaPreview> => {
    if (!(await toolNames()).includes("get_screenshot")) return fallback(hit, true);
    const png = pngOf(await hub.call("figma", "get_screenshot", { nodeId }, null));
    if (!png || !isPng(png)) return fallback(hit, true);
    store(fileKey, nodeId, png);
    return { png: png.toString("base64"), fetchedAt: host.now(), reachable: true, available: true };
  };

  return {
    async start() {
      const url = settings.get("figma.url");
      if (url !== null) await hub.setReserved("figma", url);
    },
    async configure(url: string): Promise<IntegrationStatus> {
      const previous = settings.get("figma.url");
      await hub.setReserved("figma", url);
      try {
        await checkTools();
      } catch (e) {
        await hub.setReserved("figma", previous);
        throw asKibo(e);
      }
      settings.set("figma.url", url);
      lastError = null;
      events.log("figma", "info", `configured ${url}`);
      host.broadcast({ type: "integrations" });
      return status();
    },
    status,
    async test(): Promise<IntegrationStatus> {
      if (!configured()) return status();
      try {
        await checkTools();
        lastError = null;
      } catch (e) {
        const k = asKibo(e);
        lastError = { code: k.code, message: k.detail };
      }
      return status();
    },
    async link(projectId: string, ticketId: string, raw: string): Promise<FigmaNodeRef> {
      const parsed = parseFigmaUrl(raw);
      if (!parsed) throw new KiboError("INVALID_INPUT", "not a figma node url");
      if (!configured()) throw new KiboError("NOT_CONNECTED", "figma is not configured");
      const meta = await hub.call("figma", "get_metadata", { nodeId: parsed.nodeId }, null);
      if (meta.isError) throw new KiboError("MCP_FAILED", `figma metadata failed for ${parsed.nodeId}`);
      const ref: FigmaNodeRef = {
        kind: "figma_node",
        ...parsed,
        name: nameFromMetadata(textOf(meta)) ?? parsed.nodeId,
      };
      host.command(projectId, { method: "upsertExternalRef", ticketId, ref }, USER);
      return ref;
    },
    async preview(fileKey: string, nodeId: string): Promise<FigmaPreview> {
      const hit = cached(fileKey, nodeId);
      if (hit && host.now() - hit.fetchedAt < PREVIEW_TTL_MS)
        return { ...hit, reachable: true, available: true };
      if (!configured()) return fallback(hit, false);
      try {
        return await fetchPreview(fileKey, nodeId, hit);
      } catch (e) {
        const k = asKibo(e);
        if (k.code !== "MCP_UNAVAILABLE" && k.code !== "TIMEOUT") throw k;
        events.log("figma", "warn", `preview ${fileKey}/${nodeId}: ${k.detail}`);
        return fallback(hit, false);
      }
    },
    async disconnect() {
      settings.delete("figma.url");
      lastError = null;
      await hub.setReserved("figma", null);
    },
  };
}
