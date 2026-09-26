import {
  defaultMcpSourceConfig,
  McpSourceConfig,
  type McpSourceStoredConfig,
} from "@kibo/component-mcp-source";

export type SourceMode = "tool" | "resource";
export type PointerKey = "itemsPointer" | "idPointer" | "titlePointer" | "subtitlePointer" | "urlPointer";
export const POINTER_KEYS: readonly PointerKey[] = [
  "itemsPointer",
  "idPointer",
  "titlePointer",
  "subtitlePointer",
  "urlPointer",
];

export type McpSourceDraft = {
  server: string;
  mode: SourceMode;
  tool: string;
  uri: string;
  args: string;
  refresh: string;
} & Record<PointerKey, string>;

export function draftOf(stored: McpSourceStoredConfig): McpSourceDraft {
  return {
    server: stored.server,
    mode: stored.mode,
    tool: stored.tool ?? "",
    uri: stored.uri ?? "",
    args: stored.args ?? "{}",
    refresh: String(stored.refreshMinutes ?? 15),
    itemsPointer: stored.itemsPointer,
    idPointer: stored.idPointer,
    titlePointer: stored.titlePointer,
    subtitlePointer: stored.subtitlePointer ?? "",
    urlPointer: stored.urlPointer ?? "",
  };
}

export function newDraft(server: string, tool: string | null): McpSourceDraft {
  return { ...draftOf(defaultMcpSourceConfig(server)), tool: tool ?? "" };
}

const filled = (value: string): string | null => (value.trim() === "" ? null : value.trim());

export function storedOf(d: McpSourceDraft): McpSourceStoredConfig {
  const stored: McpSourceStoredConfig = {
    server: d.server,
    mode: d.mode,
    args: d.args,
    refreshMinutes: Number(d.refresh),
    itemsPointer: d.itemsPointer,
    idPointer: d.idPointer,
    titlePointer: d.titlePointer,
  };
  const target = filled(d.mode === "tool" ? d.tool : d.uri);
  if (target !== null && d.mode === "tool") stored.tool = target;
  if (target !== null && d.mode === "resource") stored.uri = target;
  const subtitle = filled(d.subtitlePointer);
  if (subtitle !== null) stored.subtitlePointer = subtitle;
  const url = filled(d.urlPointer);
  if (url !== null) stored.urlPointer = url;
  return stored;
}

export const validStored = (d: McpSourceDraft): McpSourceStoredConfig | null => {
  const stored = storedOf(d);
  return McpSourceConfig.safeParse(stored).success ? stored : null;
};
