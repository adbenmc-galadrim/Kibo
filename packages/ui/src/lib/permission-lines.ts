import { CONFIG_SERVER_RULE, type GrantedPermissions, RESERVED_MCP_IDS } from "@kibo/schema";
import {
  Database,
  File,
  Globe,
  KeyRound,
  type LucideIcon,
  NotebookText,
  Pencil,
  Plug,
  Ticket,
  X,
} from "lucide-react";
import { fr } from "../i18n/fr";

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

export function permissionLabel(entry: string): string {
  if (entry.startsWith("mcp:")) return mcpTitle(entry.slice(4));
  const secret = SECRET_ENTRY.exec(entry);
  if (secret?.[1] && secret[2]) return fr.integrations.permissions.secret(secret[1], [secret[2]]);
  return fr.publish.permission(entry);
}

function closingLine(g: GrantedPermissions): PermissionLine | null {
  const t = fr.trust;
  if (g.mcp.length > 0) return null;
  const notes = g.reads.includes("note") || g.writes.includes("note");
  const offline = g.net.length === 0;
  if (offline && !notes) return { icon: X, title: t.noNetworkNoFiles };
  if (offline) return { icon: X, title: t.noNetwork };
  if (!notes) return { icon: X, title: t.noFiles };
  return null;
}

export function permissionLines(g: GrantedPermissions): PermissionLine[] {
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
  const closing = closingLine(g);
  return closing ? [...lines, closing] : lines;
}
