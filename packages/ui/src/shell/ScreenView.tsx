import type { Screen, WorkspaceConfig } from "@kibo/schema";
import {
  AppearancePage,
  GeneralPage,
  IntegrationsPage,
  PhonePage,
  ShortcutsPage,
  WorkspacePage,
} from "./lazy-screens";

type Props = { screen: Screen; config: WorkspaceConfig | null };

export function ScreenView({ screen, config }: Props) {
  if (screen === "general") return <GeneralPage />;
  if (screen === "integrations") return <IntegrationsPage />;
  if (screen === "appearance") return <AppearancePage />;
  if (screen === "shortcuts") return <ShortcutsPage />;
  if (screen === "workspace") return <WorkspacePage config={config} />;
  if (screen === "phone") return <PhonePage />;
  return null;
}
