import {
  isActiveT3Status,
  type ProjectInfo,
  type Status,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import { useTouchDevice } from "@kibo/sdk/hooks/use-touch-device";
import { LaunchDialog, useLaunchBlock } from "@kibo/sdk/t3";
import { type ReactNode, useState } from "react";
import { CardSheet } from "./CardSheet";

type Actions = {
  statuses: Status[];
  project: Pick<ProjectInfo, "id" | "hasFolder"> | null;
  open(t: TicketView): void;
  move(t: TicketView, statusId: StatusId): void;
  remove(t: TicketView): void;
};

const launchable = (t: TicketView, project: Actions["project"]): boolean =>
  t.startable &&
  t.key !== null &&
  project !== null &&
  !(t.thread !== null && isActiveT3Status(t.thread.status));

export function useCardSheet(actions: Actions): {
  onHold: ((t: TicketView) => void) | undefined;
  element: ReactNode;
} {
  const touch = useTouchDevice();
  const [shown, setShown] = useState<TicketView | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const { project } = actions;
  const blocked = useLaunchBlock(project?.id ?? "", project !== null && !project.hasFolder);
  const element = (
    <>
      {shown && (
        <CardSheet
          ticket={shown}
          statuses={actions.statuses}
          launch={launchable(shown, project) ? { blocked } : null}
          onClose={() => setShown(null)}
          onOpen={() => actions.open(shown)}
          onMove={(id) => actions.move(shown, id)}
          onLaunch={() => setLaunching(shown.key)}
          onRemove={() => actions.remove(shown)}
        />
      )}
      {launching && project && (
        <LaunchDialog projectId={project.id} ticketKey={launching} onClose={() => setLaunching(null)} />
      )}
    </>
  );
  return { onHold: touch ? setShown : undefined, element };
}
