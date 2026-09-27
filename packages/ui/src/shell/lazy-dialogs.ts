import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

const hidden = { fallback: "sr-only" } as const;

export const NewProjectDialog = lazyPanel(
  () => import("../dialogs/NewProjectDialog").then((m) => m.NewProjectDialog),
  fr.lazy,
  hidden,
);
export const NewPageDialog = lazyPanel(
  () => import("../dialogs/NewPageDialog").then((m) => m.NewPageDialog),
  fr.lazy,
  hidden,
);
export const StarterDialog = lazyPanel(
  () => import("../onboarding/StarterDialog").then((m) => m.StarterDialog),
  fr.lazy,
  hidden,
);
export const NewTicketDialog = lazyPanel(
  () => import("../dialogs/NewTicketDialog").then((m) => m.NewTicketDialog),
  fr.lazy,
  hidden,
);
export const AssignDialog = lazyPanel(
  () => import("../agents/AssignDialog").then((m) => m.AssignDialog),
  fr.lazy,
  hidden,
);
export const ProfileSheet = lazyPanel(
  () => import("../agents/ProfileSheet").then((m) => m.ProfileSheet),
  fr.lazy,
  hidden,
);
export const TicketSheet = lazyPanel(
  () => import("./TicketSheet").then((m) => m.TicketSheet),
  fr.lazy,
  hidden,
);
export const CommandPalette = lazyPanel(
  () => import("../palette/CommandPalette").then((m) => m.CommandPalette),
  fr.lazy,
  hidden,
);
export const ModifyWithAiDialog = lazyPanel(
  () => import("../ai/ModifyWithAiDialog").then((m) => m.ModifyWithAiDialog),
  fr.lazy,
  hidden,
);
export const ConfirmDialog = lazyPanel(
  () => import("@kibo/sdk/ui/confirm-dialog").then((m) => m.ConfirmDialog),
  fr.lazy,
  hidden,
);
export const RenameWorkspaceDialog = lazyPanel(
  () => import("../dialogs/RenameWorkspaceDialog").then((m) => m.RenameWorkspaceDialog),
  fr.lazy,
  hidden,
);
export const NotesDirDialog = lazyPanel(
  () => import("../dialogs/NotesDirDialog").then((m) => m.NotesDirDialog),
  fr.lazy,
  hidden,
);
export const TrustDialog = lazyPanel(
  () => import("../dialogs/TrustDialog").then((m) => m.TrustDialog),
  fr.lazy,
  hidden,
);
export const OpenViewDialog = lazyPanel(
  () => import("../dialogs/OpenViewDialog").then((m) => m.OpenViewDialog),
  fr.lazy,
  hidden,
);
