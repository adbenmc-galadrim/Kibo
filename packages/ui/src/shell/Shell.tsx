import type { Session } from "@kibo/schema";
import { useMemo } from "react";
import { client } from "../api";
import { createAppSettingsStore } from "../state/app-settings";
import { useAgents } from "../state/use-agents";
import { AppSettingsProvider, clientSettingsSource } from "../state/use-app-settings";
import { useProjects } from "../state/use-projects";
import { useTabs } from "../tabs/use-tabs";
import { DaemonUnreachable, IntegrationNotices } from "./lazy-screens";
import { LoadingScreen } from "./Startup";
import { useUpdateSchedule } from "./use-update-schedule";
import { Workspace } from "./Workspace";
import { inTauri } from "./workspace-actions";

export type ShellProps = { viewer: string; notifications: Session["notifications"] };

export function Shell({ viewer, notifications }: ShellProps) {
  const { projects, error, retry } = useProjects();
  const tabs = useTabs();
  const agents = useAgents();
  const settings = useMemo(() => createAppSettingsStore(clientSettingsSource(client)), []);
  useUpdateSchedule();
  if (error) return <DaemonUnreachable error={error} inApp={inTauri()} nextRetryInMs={0} onRetry={retry} />;
  if (!projects || !tabs) return <LoadingScreen />;
  return (
    <AppSettingsProvider store={settings}>
      <Workspace
        viewer={viewer}
        notifications={notifications}
        projects={projects}
        tabs={tabs}
        agents={agents}
      />
      <IntegrationNotices notifications={notifications} />
    </AppSettingsProvider>
  );
}
