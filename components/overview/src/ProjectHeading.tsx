import type { ProjectInfo } from "@kibo/sdk";
import { Building2 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { fr } from "./fr";
import { GithubMark } from "./parts";

const MFG = "text-(--tracking-mfg)";

function parts(project: ProjectInfo): { key: string; node: ReactNode }[] {
  const list: { key: string; node: ReactNode }[] = [];
  if (project.client !== null)
    list.push({
      key: "client",
      node: (
        <span className={`flex items-center gap-[8px] ${MFG}`}>
          <Building2 absoluteStrokeWidth size={13} aria-hidden />
          <span>{fr.heading.client(project.client)}</span>
        </span>
      ),
    });
  if (project.description !== null)
    list.push({ key: "description", node: <span className={MFG}>{project.description}</span> });
  if (project.repo !== null)
    list.push({
      key: "repo",
      node: (
        <span className={`flex items-center gap-[8px] ${MFG}`}>
          <GithubMark className={MFG} />
          <span className="font-mono text-[12px] leading-[15px]">{project.repo}</span>
        </span>
      ),
    });
  return list;
}

export function ProjectHeading({ project }: { project: ProjectInfo | null }) {
  if (project === null) return null;
  const items = parts(project);
  return (
    <header className="flex min-h-[49px] flex-col justify-end gap-[4px]">
      <h1 className="font-semibold text-(--tracking-fg) text-[24px] leading-[29px] tracking-[-0.3px]">
        {project.name}
      </h1>
      {items.length > 0 && (
        <p className="flex h-[16px] items-center gap-[8px] text-[13px] leading-[16px]">
          {items.map((item, i) => (
            <Fragment key={item.key}>
              {i > 0 && (
                <span aria-hidden className="text-(--tracking-faint)">
                  ·
                </span>
              )}
              {item.node}
            </Fragment>
          ))}
        </p>
      )}
    </header>
  );
}
