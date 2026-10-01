import { isInbox, type ProjectSnapshot, type TabTarget } from "@kibo/schema";
import { ChevronRight } from "lucide-react";
import { fr } from "../i18n/fr";
import { displayName } from "../lib/inbox";
import { SCREENS } from "../tabs/screens";

export type Crumb = { label: string; target: TabTarget | null };

const text = (label: string): Crumb => ({ label, target: null });

function projectCrumb(p: ProjectSnapshot): Crumb {
  const target: TabTarget = isInbox(p.meta.id)
    ? { kind: "screen", screen: "inbox" }
    : { kind: "project", projectId: p.meta.id };
  return { label: displayName(p.meta), target };
}

export function crumbsFor(
  target: TabTarget | null,
  ctx: { project: ProjectSnapshot | null; branch: string | null },
): Crumb[] {
  if (target?.kind === "screen") return SCREENS[target.screen].crumbs.map(text);
  const p = ctx.project;
  if (!target || !p) return [text(fr.nav.overview)];
  const project = projectCrumb(p);
  switch (target.kind) {
    case "project":
      return [text(project.label)];
    case "page":
      return [project, text(p.pages.find((x) => x.id === target.pageId)?.title ?? fr.tabs.missingPage)];
    case "changes":
      return ctx.branch
        ? [project, { label: fr.nav.changes, target }, text(ctx.branch)]
        : [project, text(fr.nav.changes)];
    case "file":
      return [project, text(target.path)];
    case "ticket":
      return [
        project,
        text(p.tickets.find((t) => t.id === target.ticketId)?.keyLabel ?? fr.tabs.missingTicket),
      ];
  }
}

const LINK =
  "truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

type ItemProps = {
  crumb: Crumb;
  current: boolean;
  first: boolean;
  heading: boolean;
  onOpen(t: TabTarget): void;
};

function CrumbItem({ crumb, current, first, heading, onOpen }: ItemProps) {
  const Label = current && heading ? "h1" : "span";
  const { label, target } = crumb;
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      {!first && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
      {!current && target ? (
        <button type="button" className={LINK} onClick={() => onOpen(target)}>
          {label}
        </button>
      ) : (
        <Label
          aria-current={current ? "page" : undefined}
          className={current ? "truncate font-medium text-foreground" : "truncate"}
        >
          {label}
        </Label>
      )}
    </li>
  );
}

type Props = { crumbs: Crumb[]; heading?: boolean; onOpen(target: TabTarget): void };

export function Breadcrumb({ crumbs, heading = false, onOpen }: Props) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <CrumbItem
            key={`${i}-${crumb.label}`}
            crumb={crumb}
            current={i === crumbs.length - 1}
            first={i === 0}
            heading={heading}
            onOpen={onOpen}
          />
        ))}
      </ol>
    </nav>
  );
}
