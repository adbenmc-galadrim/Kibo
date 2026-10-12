import type { ProjectSummary } from "@kibo/schema";
import { LayoutGrid } from "lucide-react";
import { frDomains } from "../i18n/fr-domains";

type Props = { project: ProjectSummary | null; files: number; domains: number; readOnly: boolean };

export function NodeHeader({ project, files, domains, readOnly }: Props) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {project ? (
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
      ) : (
        <LayoutGrid aria-hidden className="size-4 shrink-0" />
      )}
      <div className="grid min-w-0 gap-0.5">
        <h2 className="truncate text-md font-semibold">
          {project ? frDomains.project(project.name) : frDomains.workspace}
        </h2>
        <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
          {frDomains.folderMeta(project?.folder ?? null, files, domains)}
          {readOnly && <span className="rounded border px-1 text-3xs">{frDomains.readOnly}</span>}
        </p>
      </div>
    </div>
  );
}
