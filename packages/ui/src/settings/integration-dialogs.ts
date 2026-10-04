import type { IntegrationId } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import type { ComponentType } from "react";
import { fr } from "../i18n/fr";

export type IntegrationDialogId = "github" | "figma" | "penpot" | "mcp";
export type IntegrationDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  onDone(message?: string): void;
};

const lazyDialog = (load: () => Promise<ComponentType<IntegrationDialogProps>>) =>
  lazyPanel(load, fr.lazy, { fallback: "sr-only" });

export const INTEGRATION_DIALOGS: Partial<
  Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>
> = {
  github: lazyDialog(() =>
    import("../dialogs/integrations/GithubConnectDialog").then((m) => m.GithubConnectDialog),
  ),
  figma: lazyDialog(() =>
    import("../dialogs/integrations/FigmaConnectDialog").then((m) => m.FigmaConnectDialog),
  ),
  penpot: lazyDialog(() =>
    import("../dialogs/integrations/PenpotConnectDialog").then((m) => m.PenpotConnectDialog),
  ),
  mcp: lazyDialog(() => import("../dialogs/integrations/McpServersDialog").then((m) => m.McpServersDialog)),
};

export function dialogOf(id: IntegrationId): IntegrationDialogId | null {
  if (id === "github" || id === "github-issues" || id === "github-actions") return "github";
  if (id === "figma" || id === "penpot" || id === "mcp") return id;
  return null;
}
