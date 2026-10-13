import type { AutoLink, Overlap, RunMoment } from "@kibo/schema";
import { useCallback, useMemo, useState } from "react";
import { useOptionalHost } from "../shell/Host";
import { canEdit } from "../state/access";
import { useProject } from "../state/use-projects";
import { useAutoLinks } from "./use-auto-links";
import { useOverlaps } from "./use-overlaps";

export type OverlapFeedProps = {
  overlaps: ReadonlyMap<string, Overlap>;
  autoLinks: ReadonlyMap<string, AutoLink>;
  canEdit: boolean;
  onSeeFiles(overlapId: string): void;
  onIgnoreOverlap(overlapId: string): void;
  onCancelAutoLink(autoLinkId: string): void;
  onOpenTicketKey?(key: string): void;
};

export type OverlapFeed = {
  feed: OverlapFeedProps;
  filesId: string | null;
  failed: boolean;
  closeFiles(): void;
};

type FeedRun = { id: string; projectId: string | null };

const has = (moments: readonly RunMoment[], kind: "overlap" | "auto_link"): boolean =>
  moments.some((m) => m.data.kind === kind);

export function useOpenOverlap(run: FeedRun, moments: readonly RunMoment[]): OverlapFeed {
  const host = useOptionalHost();
  const withOverlaps = run.projectId !== null && has(moments, "overlap");
  const withLinks = run.projectId !== null && has(moments, "auto_link");
  const project = useProject(withOverlaps || withLinks ? run.projectId : null);
  const { overlaps, ignore } = useOverlaps(withOverlaps ? { runId: run.id } : null);
  const { byId, cancel } = useAutoLinks(withLinks ? run.projectId : null);
  const [filesId, setFilesId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const attempt = useCallback((action: Promise<void>) => {
    setFailed(false);
    action.catch(() => setFailed(true));
  }, []);
  const byOverlap = useMemo(() => new Map(overlaps.map((o) => [o.id, o])), [overlaps]);
  const openTicketKey =
    project && host
      ? (key: string) => {
          const ticket = project.tickets.find((t) => t.keyLabel === key);
          if (ticket) host.openTarget({ kind: "ticket", projectId: project.meta.id, ticketId: ticket.id });
        }
      : undefined;
  return {
    feed: {
      overlaps: byOverlap,
      autoLinks: byId,
      canEdit: project !== null && canEdit(project),
      onSeeFiles: setFilesId,
      onIgnoreOverlap: (id) => attempt(ignore(id)),
      onCancelAutoLink: (id) => attempt(cancel(id)),
      onOpenTicketKey: openTicketKey,
    },
    filesId,
    failed,
    closeFiles: () => setFilesId(null),
  };
}
