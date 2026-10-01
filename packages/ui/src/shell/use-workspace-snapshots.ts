import { INBOX_ID, type ProjectMeta } from "@kibo/schema";
import { useMemo } from "react";
import { openInboxCount, withInbox } from "../lib/inbox";
import { countMine, myTickets } from "../mine/my-tickets";
import { useSnapshots } from "../state/use-snapshots";

export function useWorkspaceSnapshots(projects: readonly ProjectMeta[], viewer: string) {
  const ids = useMemo(() => [...projects.map((p) => p.id), INBOX_ID], [projects]);
  const snapshots = useSnapshots(ids);
  const mineCount = useMemo(
    () => countMine(myTickets(withInbox(projects, snapshots), snapshots, viewer, "assigned")),
    [projects, snapshots, viewer],
  );
  return { snapshots, mineCount, inboxCount: openInboxCount(snapshots.get(INBOX_ID)) };
}
