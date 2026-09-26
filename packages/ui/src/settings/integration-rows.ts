import type { IntegrationId, IntegrationStatus } from "@kibo/schema";
import {
  Bell,
  FileText,
  Frame,
  GitCommitHorizontal,
  GitPullRequestArrow,
  ListTodo,
  type LucideIcon,
  Plug,
  SquareTerminal,
} from "lucide-react";
import { fr } from "../i18n/fr";

export type RowMenuItem = "configure" | "test" | "disconnect";
export type RowView = {
  id: IntegrationId;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: { tone: "ok" | "warn" | "error"; label: string } | null;
  action: "connect" | "retry" | null;
  menu: RowMenuItem[];
  error: string | null;
};

const ICONS: Record<IntegrationId, LucideIcon> = {
  git: GitCommitHorizontal,
  github: GitPullRequestArrow,
  "github-issues": ListTodo,
  "github-actions": SquareTerminal,
  figma: Frame,
  notifications: Bell,
  markdown: FileText,
  mcp: Plug,
};

const MENUS: Record<IntegrationId, RowMenuItem[]> = {
  git: [],
  github: ["configure", "test", "disconnect"],
  "github-issues": ["configure", "test"],
  "github-actions": ["configure", "test"],
  figma: ["configure", "test", "disconnect"],
  notifications: [],
  markdown: ["test"],
  mcp: ["configure", "test"],
};

function describe(s: IntegrationStatus): { title: string; description: string } {
  const r = fr.integrations.rows;
  switch (s.id) {
    case "github":
      return { title: r.github.title, description: r.github.description(s.account) };
    case "mcp":
      return { title: r.mcp.title, description: r.mcp.description(s.servers) };
    default:
      return r[s.id];
  }
}

export function integrationRow(
  s: IntegrationStatus,
  opts: { hasDialog(id: IntegrationId): boolean; time(ms: number): string },
): RowView {
  const t = fr.integrations.state;
  const base = { id: s.id, icon: ICONS[s.id], ...describe(s), error: null, menu: MENUS[s.id] };
  switch (s.state) {
    case "active":
      return { ...base, badge: { tone: "ok", label: t.active }, action: null, menu: [] };
    case "disconnected":
      return { ...base, badge: null, action: opts.hasDialog(s.id) ? "connect" : null, menu: [] };
    case "error":
      return {
        ...base,
        badge: { tone: "error", label: t.error },
        action: "retry",
        error: s.error?.message ?? t.error,
      };
    case "connected":
      return {
        ...base,
        badge:
          s.resumeAt !== null
            ? { tone: "warn", label: t.rateLimited(opts.time(s.resumeAt)) }
            : { tone: "ok", label: t.connected },
        action: null,
      };
  }
}
