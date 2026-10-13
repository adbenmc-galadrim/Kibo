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
      <div className="grid min-w-0 flex-1 gap-0.5">
        <h2 className="truncate text-md font-semibold">
          {project ? frDomains.project(project.name) : frDomains.workspace}
        </h2>
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {project?.folder && (
            <>
              <span className="min-w-0 truncate" title={project.folder}>
                {project.folder}
              </span>
              <span aria-hidden className="shrink-0">
                ·
              </span>
            </>
          )}
          <span className="shrink-0">{frDomains.folderCounts(files, domains)}</span>
          {readOnly && (
            <span className="ml-1 shrink-0 rounded border px-1 text-3xs">{frDomains.readOnly}</span>
          )}
        </p>
      </div>
    </div>
  );
}
