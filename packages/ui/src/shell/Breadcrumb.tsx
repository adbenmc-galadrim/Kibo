import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { ChevronRight } from "lucide-react";
import { fr } from "../i18n/fr";
import type { Screen } from "../route";

export function crumbsFor(
  target: TabTarget | null,
  ctx: { project: ProjectSnapshot | null; branch: string | null },
): string[] {
  const p = ctx.project;
  if (!target || !p) return [fr.nav.overview];
  const name = p.meta.name;
  switch (target.kind) {
    case "project":
      return [name];
    case "page":
      return [name, p.pages.find((x) => x.id === target.pageId)?.title ?? fr.tabs.missingPage];
    case "changes":
      return ctx.branch ? [name, fr.nav.changes, ctx.branch] : [name, fr.nav.changes];
    case "file":
      return [name, target.path];
    case "ticket":
      return [name, p.tickets.find((t) => t.id === target.ticketId)?.key ?? fr.tabs.missingTicket];
  }
}

export function screenCrumbs(screen: Screen): string[] {
  if (screen === "agents") return [fr.nav.agents];
  if (screen === "queue") return [fr.nav.agents, fr.nav.queue];
  return [fr.nav.settings, fr.nav.domains];
}

function Crumb({
  label,
  current,
  first,
  heading,
}: {
  label: string;
  current: boolean;
  first: boolean;
  heading: boolean;
}) {
  const Label = current && heading ? "h1" : "span";
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      {!first && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
      <Label
        aria-current={current ? "page" : undefined}
        className={current ? "truncate font-medium text-foreground" : "truncate"}
      >
        {label}
      </Label>
    </li>
  );
}

export function Breadcrumb({ crumbs, heading = false }: { crumbs: string[]; heading?: boolean }) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((label, i) => (
          <Crumb
            key={`${i}-${label}`}
            label={label}
            current={i === crumbs.length - 1}
            first={i === 0}
            heading={heading}
          />
        ))}
      </ol>
    </nav>
  );
}
