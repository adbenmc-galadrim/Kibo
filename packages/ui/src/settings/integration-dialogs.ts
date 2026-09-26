import type { IntegrationId } from "@kibo/schema";
import type { ComponentType } from "react";

export type IntegrationDialogId = "github" | "figma" | "mcp";
export type IntegrationDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  onDone(message?: string): void;
};
export const INTEGRATION_DIALOGS: Partial<
  Record<IntegrationDialogId, ComponentType<IntegrationDialogProps>>
> = {};

export function dialogOf(id: IntegrationId): IntegrationDialogId | null {
  if (id === "github" || id === "github-issues" || id === "github-actions") return "github";
  if (id === "figma" || id === "mcp") return id;
  return null;
}
