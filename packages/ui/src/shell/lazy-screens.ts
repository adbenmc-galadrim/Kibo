import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const AgentsPage = lazyPanel(() => import("../agents/AgentsPage").then((m) => m.AgentsPage), fr.lazy);
export const QueuePage = lazyPanel(() => import("../agents/QueuePage").then((m) => m.QueuePage), fr.lazy);
export const DomainsPage = lazyPanel(
  () => import("../settings/DomainsPage").then((m) => m.DomainsPage),
  fr.lazy,
);
export const ComponentsPage = lazyPanel(
  () => import("../components-page/ComponentsPage").then((m) => m.ComponentsPage),
  fr.lazy,
);
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
