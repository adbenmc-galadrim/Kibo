import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const AgentsPage = lazyPanel(() => import("../agents/AgentsPage").then((m) => m.AgentsPage), fr.lazy);
export const QueuePage = lazyPanel(() => import("../agents/QueuePage").then((m) => m.QueuePage), fr.lazy);
export const GeneralPage = lazyPanel(
  () => import("../settings/GeneralPage").then((m) => m.GeneralPage),
  fr.lazy,
);
export const DomainsPage = lazyPanel(
  () => import("../settings/DomainsPage").then((m) => m.DomainsPage),
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
export const SecurityPage = lazyPanel(
  () => import("../settings/SecurityPage").then((m) => m.SecurityPage),
  fr.lazy,
);
export const SyncSettingsPage = lazyPanel(
  () => import("../settings/SyncSettingsPage").then((m) => m.SyncSettingsPage),
  fr.lazy,
);
export const ComponentSourcesPage = lazyPanel(
  () => import("../settings/ComponentSourcesPage").then((m) => m.ComponentSourcesPage),
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
export const ComponentsPage = lazyPanel(
  () => import("../components-page/ComponentsPage").then((m) => m.ComponentsPage),
  fr.lazy,
);
export const MyTicketsPage = lazyPanel(
  () => import("../mine/MyTicketsPage").then((m) => m.MyTicketsPage),
  fr.lazy,
);
export const InboxPage = lazyPanel(() => import("../inbox/InboxPage").then((m) => m.InboxPage), fr.lazy);
export const TicketTab = lazyPanel(() => import("../pages/TicketTab").then((m) => m.TicketTab), fr.lazy);
export const Welcome = lazyPanel(() => import("./Welcome").then((m) => m.Welcome), fr.lazy);
export const ChangesView = lazyPanel(() => import("../code/ChangesView").then((m) => m.ChangesView), fr.lazy);
export const FileTabView = lazyPanel(
  () => import("../files/FileTabView").then((m) => m.FileTabView),
  fr.lazy,
);
export const FilePreviewSheet = lazyPanel(
  () => import("../files/FilePreviewSheet").then((m) => m.FilePreviewSheet),
  fr.lazy,
  { fallback: "sr-only" },
);
export const SourceHeader = lazyPanel(
  () => import("../pages/SourceHeader").then((m) => m.SourceHeader),
  fr.lazy,
  { fallback: "sr-only" },
);
export const IntegrationNotices = lazyPanel(
  () => import("./IntegrationNotices").then((m) => m.IntegrationNotices),
  fr.lazy,
  { fallback: "sr-only" },
);
const shareEntry = () => import("./share-entry");
const hidden = { fallback: "sr-only" } as const;

export const ProjectStatusBanner = lazyPanel(
  () => shareEntry().then((m) => m.ProjectStatusBanner),
  fr.lazy,
  hidden,
);
export const ShareButton = lazyPanel(() => shareEntry().then((m) => m.ShareButton), fr.lazy, hidden);
export const ProjectHeaderMenu = lazyPanel(() => shareEntry().then((m) => m.ProjectHeaderMenu), fr.lazy, {
  fallback: "children",
});
export const JoinProjectEntry = lazyPanel(
  () => shareEntry().then((m) => m.JoinProjectEntry),
  fr.lazy,
  hidden,
);
export const ShareProjectDialog = lazyPanel(
  () => shareEntry().then((m) => m.ShareProjectDialog),
  fr.lazy,
  hidden,
);
export const JoinProjectDialog = lazyPanel(
  () => shareEntry().then((m) => m.JoinProjectDialog),
  fr.lazy,
  hidden,
);
const presenceEntry = () => import("./presence-entry");

export const ProjectPresence = lazyPanel(
  () => presenceEntry().then((m) => m.ProjectPresence),
  fr.lazy,
  hidden,
);
export const PresenceAvatars = lazyPanel(
  () => presenceEntry().then((m) => m.PresenceAvatars),
  fr.lazy,
  hidden,
);
export const PairingScreen = lazyPanel(() => import("./PairingScreen").then((m) => m.PairingScreen), fr.lazy);
export const AgentDrawer = lazyPanel(
  () => import("../agents/AgentDrawer").then((m) => m.AgentDrawer),
  fr.lazy,
);
export const ScreenActions = lazyPanel(
  () => import("./ScreenActions").then((m) => m.ScreenActions),
  fr.lazy,
  { fallback: "sr-only" },
);
export const RunHistoryList = lazyPanel(
  () => import("./RunHistoryList").then((m) => m.RunHistoryList),
  fr.lazy,
  hidden,
);
export const UserMenuContent = lazyPanel(
  () => import("./UserMenuContent").then((m) => m.UserMenuContent),
  fr.lazy,
  hidden,
);
const daemonUnreachable = () => import("./DaemonUnreachable").then((m) => m.DaemonUnreachable);

export const preloadDaemonUnreachable = daemonUnreachable;
export const DaemonUnreachable = lazyPanel(daemonUnreachable, fr.lazy);
