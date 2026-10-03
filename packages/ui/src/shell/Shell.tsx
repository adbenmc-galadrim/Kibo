import type { Session } from "@kibo/schema";
import { useRunNotifications } from "../agents/use-run-notifications";
import { useAgents } from "../state/use-agents";
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
  useRunNotifications(agents, notifications === "browser");
  useUpdateSchedule();
  if (error) return <DaemonUnreachable error={error} inApp={inTauri()} nextRetryInMs={0} onRetry={retry} />;
  if (!projects || !tabs) return <LoadingScreen />;
  return (
    <>
      <Workspace
        viewer={viewer}
        notifications={notifications}
        projects={projects}
        tabs={tabs}
        agents={agents}
      />
      <IntegrationNotices notifications={notifications} />
    </>
  );
}
