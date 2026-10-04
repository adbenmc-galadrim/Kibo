import { lazyPanel } from "@kibo/sdk";
import { fr } from "../i18n/fr";

export const ProjectFilesDialog = lazyPanel(
  () => import("./ProjectFilesDialog").then((m) => m.ProjectFilesDialog),
  fr.lazy,
  { fallback: "sr-only" },
);
