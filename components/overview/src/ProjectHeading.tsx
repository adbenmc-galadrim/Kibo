import type { ProjectInfo } from "@kibo/sdk";
import { GithubMark } from "./parts";

export function ProjectHeading({ project }: { project: ProjectInfo | null }) {
  if (project === null) return null;
  const mfg = "text-(--tracking-mfg)";
  return (
    <header className="flex min-h-[49px] flex-col justify-end gap-[4px]">
      <h1 className="font-semibold text-(--tracking-fg) text-[24px] leading-[29px] tracking-[-0.3px]">
        {project.name}
      </h1>
      {(project.description !== null || project.repo !== null) && (
        <p className="flex h-[16px] items-center gap-[8px] text-[13px] leading-[16px]">
          {project.description !== null && <span className={mfg}>{project.description}</span>}
          {project.description !== null && project.repo !== null && (
            <span aria-hidden className="text-(--tracking-faint)">
              ·
            </span>
          )}
          {project.repo !== null && (
            <span className={`flex items-center gap-[8px] ${mfg}`}>
              <GithubMark className={mfg} />
              <span className="font-mono text-[12px] leading-[15px]">{project.repo}</span>
            </span>
          )}
        </p>
      )}
    </header>
  );
}
