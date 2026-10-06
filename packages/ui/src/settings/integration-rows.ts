import type { IntegrationId, IntegrationStatus } from "@kibo/schema";
import {
  Bell,
  FileText,
  Frame,
  GitCommitHorizontal,
  GitPullRequestArrow,
  ListTodo,
  type LucideIcon,
  PenTool,
  Plug,
  SquareTerminal,
} from "lucide-react";
import { fr } from "../i18n/fr";
import { integrationErrorText } from "../lib/remote-error";

export type RowMenuItem = "configure" | "test" | "disconnect";
export type RowAction = "connect" | "retry" | "reconnect";
export type RowView = {
  id: IntegrationId;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: { tone: "ok" | "warn" | "error"; label: string } | null;
  action: RowAction | null;
  menu: RowMenuItem[];
  error: string | null;
};

const ICONS: Record<IntegrationId, LucideIcon> = {
  git: GitCommitHorizontal,
  github: GitPullRequestArrow,
  "github-issues": ListTodo,
  "github-actions": SquareTerminal,
  figma: Frame,
  penpot: PenTool,
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
  penpot: ["configure", "test", "disconnect"],
  notifications: [],
  markdown: ["test"],
  mcp: ["configure", "test", "disconnect"],
};
const GITHUB_ROWS: ReadonlySet<IntegrationId> = new Set(["github", "github-issues", "github-actions"]);

const errorAction = (s: IntegrationStatus): RowAction =>
  s.error?.code === "TOKEN_IGNORED" || (GITHUB_ROWS.has(s.id) && s.error?.code === "NOT_CONNECTED")
    ? "reconnect"
    : "retry";

function describe(s: IntegrationStatus): { title: string; description: string } {
  const r = fr.integrations.rows;
  switch (s.id) {
    case "github":
      return { title: r.github.title, description: r.github.description(s.account) };
    case "mcp":
      return { title: r.mcp.title, description: r.mcp.description(s.servers) };
    case "figma":
    case "penpot":
      return { title: r[s.id].title, description: r[s.id].description(s.account) };
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
        action: errorAction(s),
        error: s.error ? integrationErrorText(s.id, s.error) : t.error,
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
