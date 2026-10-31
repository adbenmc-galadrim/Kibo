import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const GeneralPage = lazyPanel(
  () => import("../settings/GeneralPage").then((m) => m.GeneralPage),
  fr.lazy,
);
export const IntegrationsPage = lazyPanel(
  () => import("../settings/IntegrationsPage").then((m) => m.IntegrationsPage),
  fr.lazy,
);
export const AppearancePage = lazyPanel(
  () => import("../settings/AppearancePage").then((m) => m.AppearancePage),
  fr.lazy,
);
export const ShortcutsPage = lazyPanel(
  () => import("../settings/ShortcutsPage").then((m) => m.ShortcutsPage),
  fr.lazy,
);
export const WorkspacePage = lazyPanel(
  () => import("../settings/WorkspacePage").then((m) => m.WorkspacePage),
  fr.lazy,
);
export const TicketTab = lazyPanel(() => import("../pages/TicketTab").then((m) => m.TicketTab), fr.lazy);
export const Welcome = lazyPanel(() => import("./Welcome").then((m) => m.Welcome), fr.lazy);
export const FileTabView = lazyPanel(
  () => import("../files/FileTabView").then((m) => m.FileTabView),
  fr.lazy,
);
export const FilePreviewSheet = lazyPanel(
  () => import("../files/FilePreviewSheet").then((m) => m.FilePreviewSheet),
  fr.lazy,
  { fallback: "sr-only" },
);
export const IntegrationNotices = lazyPanel(
  () => import("./IntegrationNotices").then((m) => m.IntegrationNotices),
  fr.lazy,
  { fallback: "sr-only" },
);
export const WorkspaceMenuItems = lazyPanel(
  () => import("./nav/WorkspaceMenuItems").then((m) => m.WorkspaceMenuItems),
  fr.lazy,
  { fallback: "sr-only" },
);
const hidden = { fallback: "sr-only" } as const;

export const ProjectHeaderMenu = lazyPanel(
  () => import("./ProjectHeaderMenu").then((m) => m.ProjectHeaderMenu),
  fr.lazy,
  { fallback: "children" },
);
export const Unpaired = lazyPanel(() => import("./Unpaired").then((m) => m.Unpaired), fr.lazy);
export const UserMenuContent = lazyPanel(
  () => import("./UserMenuContent").then((m) => m.UserMenuContent),
  fr.lazy,
  hidden,
);
const daemonUnreachable = () => import("./DaemonUnreachable").then((m) => m.DaemonUnreachable);

export const preloadDaemonUnreachable = daemonUnreachable;
export const DaemonUnreachable = lazyPanel(daemonUnreachable, fr.lazy);
const agentEntry = () => import("../project-agent/project-agent-entry");

export const ProjectAgentButton = lazyPanel(() => agentEntry().then((m) => m.ProjectAgentButton), fr.lazy, {
  fallback: "children",
});
export const ProjectAgentPanel = lazyPanel(
  () => agentEntry().then((m) => m.ProjectAgentPanel),
  fr.lazy,
  hidden,
);

export const PageInstanceMenu = lazyPanel(
  () => import("../pages/PageInstanceMenu").then((m) => m.PageInstanceMenu),
  fr.lazy,
  { fallback: "children" },
);
