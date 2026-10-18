import { isInbox, type ProjectSnapshot, type RunView, type Screen, type TabTarget } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frNavTracking } from "../i18n/fr-nav-tracking";
import { displayName } from "../lib/inbox";
import { SCREENS } from "../tabs/screens";
import { findTicket } from "../tabs/target-hash";
import { featureOf, planningPageOf } from "./nav/planning-missing";

export type Crumb = { label: string; target: TabTarget | null; color?: string };

const text = (label: string): Crumb => ({ label, target: null });

function projectCrumb(p: ProjectSnapshot): Crumb {
  const target: TabTarget = isInbox(p.meta.id)
    ? { kind: "screen", screen: "inbox" }
    : { kind: "project", projectId: p.meta.id };
  return { label: displayName(p.meta), target, color: p.meta.color };
}

function screenCrumbs(screen: Screen): Crumb[] {
  const { crumbs, parent } = SCREENS[screen];
  return crumbs.map((label, i) =>
    parent && i === 0 ? { label, target: { kind: "screen", screen: parent } } : text(label),
  );
}

function runCrumbs(runId: string, runs: readonly RunView[] | undefined): Crumb[] {
  const label = runs?.find((r) => r.id === runId)?.label ?? fr.tabs.run;
  return [{ label: fr.nav.agents, target: { kind: "screen", screen: "agents" } }, text(label)];
}

function underPlanning(p: ProjectSnapshot, project: Crumb, title: Crumb): Crumb[] {
  const planning = p.pages.find((x) => x.id === planningPageOf(p));
  if (!planning) return [project, title];
  const target: TabTarget = { kind: "page", projectId: p.meta.id, pageId: planning.id };
  return [project, { label: planning.title, target }, title];
}

function ticketCrumbs(p: ProjectSnapshot, ref: string, project: Crumb): Crumb[] {
  const ticket = findTicket(p.tickets, ref);
  const feature = ticket ? featureOf(p, ticket.id) : undefined;
  if (!feature) return [project, text(ticket?.keyLabel ?? fr.tabs.missingTicket)];
  return underPlanning(
    p,
    project,
    text(feature.shortKey ? `${feature.shortKey} · ${feature.title}` : feature.title),
  );
}

function sprintCrumbs(p: ProjectSnapshot, sprintId: string, project: Crumb): Crumb[] {
  const sprint = p.sprints.find((s) => s.id === sprintId);
  if (!sprint) return [project, text(frNavTracking.missingSprint)];
  return underPlanning(p, project, text(`${sprint.code} · ${sprint.name}`));
}

export function crumbsFor(
  target: TabTarget | null,
  ctx: { project: ProjectSnapshot | null; branch: string | null; runs?: readonly RunView[] },
): Crumb[] {
  if (target?.kind === "screen") return screenCrumbs(target.screen);
  if (target?.kind === "run") return runCrumbs(target.runId, ctx.runs);
  if (target?.kind === "skill") return [...screenCrumbs("skills"), text(target.skillId)];
  const p = ctx.project;
  if (!target || !p) return [text(fr.nav.overview)];
  const project = projectCrumb(p);
  switch (target.kind) {
    case "project":
      return [{ ...project, target: null }];
    case "page":
      return [project, text(p.pages.find((x) => x.id === target.pageId)?.title ?? fr.tabs.missingPage)];
    case "changes":
      return ctx.branch
        ? [project, { label: fr.nav.changes, target }, text(ctx.branch)]
        : [project, text(fr.nav.changes)];
    case "file":
      return [project, text(target.path)];
    case "ticket":
      return ticketCrumbs(p, target.ticketId, project);
    case "sprint":
      return sprintCrumbs(p, target.sprintId, project);
  }
}

const LINK =
  "truncate rounded-sm outline-none hover:text-(--tracking-fg) hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

type ItemProps = {
  crumb: Crumb;
  current: boolean;
  first: boolean;
  heading: boolean;
  onOpen(t: TabTarget, keep?: boolean): void;
};

function CrumbItem({ crumb, current, first, heading, onOpen }: ItemProps) {
  const Label = current && heading ? "h1" : "span";
  const { label, target } = crumb;
  return (
    <li>
      {!first && (
        <span aria-hidden className="k-sep">
          /
        </span>
      )}
      {crumb.color && <b aria-hidden className="k-dot" style={{ background: crumb.color }} />}
      {!current && target ? (
        <button
          type="button"
          className={LINK}
          onClick={() => onOpen(target)}
          onDoubleClick={() => onOpen(target, true)}
        >
          {label}
        </button>
      ) : (
        <Label aria-current={current ? "page" : undefined} className="truncate">
          {label}
        </Label>
      )}
    </li>
  );
}

type Props = { crumbs: Crumb[]; heading?: boolean; onOpen(target: TabTarget, keep?: boolean): void };

export function Breadcrumb({ crumbs, heading = false, onOpen }: Props) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="k-crumbs">
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
