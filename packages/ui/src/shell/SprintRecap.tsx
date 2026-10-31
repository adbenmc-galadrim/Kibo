import {
  endedSprintRecap,
  type Link,
  type ProjectSnapshot,
  type SprintView,
  type TicketView,
} from "@kibo/schema";
import { SprintRecapCard } from "@kibo/sdk/tracking";
import { useState } from "react";
import { useDaemonToday } from "./use-daemon-today";

export const recapKey = (projectId: string, code: string): string => `kibo:sprint-recap:${projectId}:${code}`;

type Props = {
  projectId: string;
  project: { tickets: readonly TicketView[]; links: readonly Link[]; sprints: readonly SprintView[] };
  today: string | null;
  onOpenPlanning(): void;
};

export function SprintRecap({ projectId, project, today, onOpenPlanning }: Props) {
  const [closed, setClosed] = useState(0);
  const recap = today === null ? null : endedSprintRecap(project, today);
  if (recap === null) return null;
  const key = recapKey(projectId, recap.code);
  if (localStorage.getItem(key) !== null) return null;
  const close = () => {
    localStorage.setItem(key, "1");
    setClosed(closed + 1);
  };
  return <SprintRecapCard recap={recap} onOpenPlanning={onOpenPlanning} onClose={close} />;
}

export function ProjectSprintRecap({
  project,
  onOpenPlanning,
}: {
  project: ProjectSnapshot;
  onOpenPlanning(): void;
}) {
  const today = useDaemonToday();
  return (
    <SprintRecap
      projectId={project.meta.id}
      project={project}
      today={today}
      onOpenPlanning={onOpenPlanning}
    />
  );
}
