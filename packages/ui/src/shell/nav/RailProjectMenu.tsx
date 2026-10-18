import type { Page, ProjectSnapshot, TabTarget } from "@kibo/schema";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@kibo/sdk/ui/hover-card";
import { type MouseEvent, type ReactNode, useState } from "react";
import { frRail } from "../../i18n/fr-rail";
import { pageIcon } from "../../registry";

type Props = {
  name: string;
  projectId: string;
  snapshot: ProjectSnapshot | null;
  activePageId: string | null;
  onOpen(target: TabTarget, newTab: boolean): void;
  children: ReactNode;
};

const wantsNewTab = (e: MouseEvent) => e.metaKey || e.ctrlKey;

function PageButton({
  page,
  snapshot,
  active,
  onOpen,
}: {
  page: Page;
  snapshot: ProjectSnapshot;
  active: boolean;
  onOpen(e: MouseEvent): void;
}) {
  const Icon = pageIcon(page, snapshot.instances);
  return (
    <li>
      <button type="button" data-active={active || undefined} className="k-row" onClick={onOpen}>
        <Icon size={15} absoluteStrokeWidth />
        <span>{page.title}</span>
      </button>
    </li>
  );
}

export function RailProjectMenu({ name, projectId, snapshot, activePageId, onOpen, children }: Props) {
  const [open, setOpen] = useState(false);
  const go = (target: TabTarget, e: MouseEvent) => {
    setOpen(false);
    onOpen(target, wantsNewTab(e));
  };
  const pages = (snapshot?.pages ?? []).filter((p) => p.parentId === null);
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={150}>
      <HoverCardTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={8} className="k-rail-menu w-56 p-1.5">
        <nav aria-label={frRail.pages(name)}>
          <button
            type="button"
            className="k-row k-rail-title"
            onClick={(e) => go({ kind: "project", projectId }, e)}
          >
            <span>{name}</span>
          </button>
          <ul className="k-list">
            {snapshot &&
              pages.map((page) => (
                <PageButton
                  key={page.id}
                  page={page}
                  snapshot={snapshot}
                  active={page.id === activePageId}
                  onOpen={(e) => go({ kind: "page", projectId, pageId: page.id }, e)}
                />
              ))}
          </ul>
        </nav>
      </HoverCardContent>
    </HoverCard>
  );
}
