import { ChevronRight } from "lucide-react";
import { fr } from "../i18n/fr";

function Crumb({ label, current, first }: { label: string; current: boolean; first: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      {!first && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
      <span
        aria-current={current ? "page" : undefined}
        className={current ? "truncate font-medium text-foreground" : "truncate"}
      >
        {label}
      </span>
    </li>
  );
}

export function Breadcrumb({ project, page }: { project: string | null; page: string | null }) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Crumb label={project ?? fr.nav.overview} current={!page} first />
        {project && page && <Crumb label={page} current first={false} />}
      </ol>
    </nav>
  );
}
