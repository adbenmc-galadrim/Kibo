import type { PermissionMode } from "@kibo/schema";
import { frAgentsPage } from "../i18n/fr-agents-page";

export function permissionModeLabel(mode: PermissionMode): string {
  return frAgentsPage.permissionModes[mode];
}
