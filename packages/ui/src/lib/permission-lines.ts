import {
  CAPABILITIES,
  type Capability,
  CONFIG_SERVER_RULE,
  capPermission,
  type GrantedPermissions,
  RESERVED_MCP_IDS,
} from "@kibo/schema";
import {
  AppWindow,
  Box,
  Database,
  File,
  FolderOpen,
  Frame,
  Gamepad2,
  Globe,
  KeyRound,
  type LucideIcon,
  Maximize2,
  MousePointerClick,
  NotebookText,
  Pencil,
  Plug,
  Ticket,
  Volume2,
  X,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { frTrustCapabilities as caps } from "../i18n/fr-trust-capabilities";

export type PermissionLine = { icon: LucideIcon; title: string; detail?: string };

const mcpTitle = (rule: string): string =>
  rule === CONFIG_SERVER_RULE
    ? fr.integrations.permissions.mcpFromConfig
    : fr.integrations.permissions.mcp(rule);

const usableByThirdParty = (rule: string): boolean =>
  rule !== CONFIG_SERVER_RULE && !RESERVED_MCP_IDS.includes(rule.split("/")[0] ?? rule);

const entityList = (entities: string[]): string =>
  fr.trust.entities(entities.map(fr.trust.entityName).join(", "));

const SECRET_ENTRY = /^secret:(.+)@([^@]+)$/;

const CAPABILITY_ICONS: Record<Capability, LucideIcon> = {
  webgl: Box,
  audio: Volume2,
  fullscreen: Maximize2,
  gamepad: Gamepad2,
  assets: FolderOpen,
  design: Frame,
  embed: AppWindow,
};
const CAPABILITY_HELP: Partial<Record<Capability, string>> = {
  webgl: caps.webglHelp,
  assets: caps.assetsHelp,
  design: caps.designHelp,
  embed: caps.embedHelp,
};

export type PermissionExtras = { selection?: boolean; embeds?: readonly string[] };

function capabilityTitle(c: Capability, embeds: readonly string[]): string {
  return c === "embed" && embeds.length > 0 ? caps.embedHosts(embeds.join(", ")) : caps[c];
}

function capabilityLine(c: Capability, embeds: readonly string[]): PermissionLine {
  const detail = CAPABILITY_HELP[c];
  return { icon: CAPABILITY_ICONS[c], title: capabilityTitle(c, embeds), ...(detail && { detail }) };
}

export function permissionLabel(entry: string): string {
  if (entry.startsWith("mcp:")) return mcpTitle(entry.slice(4));
  const capability = CAPABILITIES.find((c) => entry === capPermission(c));
  if (capability) return caps[capability];
  const secret = SECRET_ENTRY.exec(entry);
  if (secret?.[1] && secret[2]) return fr.integrations.permissions.secret(secret[1], [secret[2]]);
  return fr.publish.permission(entry);
}

function closingLine(g: GrantedPermissions): PermissionLine | null {
  const t = fr.trust;
  if (g.mcp.length > 0) return null;
  const files = g.reads.includes("note") || g.writes.includes("note") || g.capabilities.includes("assets");
  const offline = g.net.length === 0;
  if (offline && !files) return { icon: X, title: t.noNetworkNoFiles };
  if (offline) return { icon: X, title: t.noNetwork };
  if (!files) return { icon: X, title: t.noFiles };
  return null;
}

export function permissionLines(g: GrantedPermissions, extra: PermissionExtras = {}): PermissionLine[] {
  const t = fr.trust;
  const lines: PermissionLine[] = [];
  const reads = g.reads.filter((e) => e !== "note");
  if (reads.length > 0) {
    const tickets = reads.includes("ticket");
    lines.push({
      icon: tickets ? Ticket : Database,
      title: tickets ? t.readTickets : t.readData,
      detail: entityList(reads),
    });
  }
  if (g.reads.includes("note")) lines.push({ icon: NotebookText, title: t.readNotes });
  if (g.writes.length > 0) lines.push({ icon: Pencil, title: t.writeData, detail: entityList(g.writes) });
  if (g.data) lines.push({ icon: File, title: t.ownData, detail: t.ownDataHelp });
  if (g.net.length > 0)
    lines.push({ icon: Globe, title: t.network, detail: t.networkHelp(g.net.join(", ")) });
  for (const s of g.secrets)
    lines.push({ icon: KeyRound, title: fr.integrations.permissions.secret(s.name, s.hosts) });
  for (const rule of g.mcp.filter(usableByThirdParty)) lines.push({ icon: Plug, title: mcpTitle(rule) });
  for (const c of CAPABILITIES.filter((x) => g.capabilities.includes(x)))
    lines.push(capabilityLine(c, extra.embeds ?? []));
  if (extra.selection) lines.push({ icon: MousePointerClick, title: caps.selection });
  const closing = closingLine(g);
  return closing ? [...lines, closing] : lines;
}
