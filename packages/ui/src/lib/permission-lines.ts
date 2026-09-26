import type { GrantedPermissions } from "@kibo/schema";
import { Database, File, Globe, type LucideIcon, NotebookText, Pencil, Ticket, X } from "lucide-react";
import { fr } from "../i18n/fr";

export type PermissionLine = { icon: LucideIcon; title: string; detail?: string };

function closingLine(g: GrantedPermissions): PermissionLine | null {
  const t = fr.trust;
  const notes = g.reads.includes("note") || g.writes.includes("note");
  if (g.net.length === 0 && !notes) return { icon: X, title: t.noNetworkNoFiles };
  if (g.net.length === 0) return { icon: X, title: t.noNetwork };
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
      detail: t.entities(reads.join(", ")),
    });
  }
  if (g.reads.includes("note")) lines.push({ icon: NotebookText, title: t.readNotes });
  if (g.writes.length > 0)
    lines.push({ icon: Pencil, title: t.writeData, detail: t.entities(g.writes.join(", ")) });
  if (g.data) lines.push({ icon: File, title: t.ownData, detail: t.ownDataHelp });
  if (g.net.length > 0)
    lines.push({ icon: Globe, title: t.network, detail: t.networkHelp(g.net.join(", ")) });
  const closing = closingLine(g);
  return closing ? [...lines, closing] : lines;
}
