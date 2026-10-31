import { ChevronRight } from "lucide-react";
import { frToday as t } from "./fr-today";
import type { TodayProject } from "./today-model";

type Props = { projects: readonly TodayProject[]; onOpen(projectId: string): void };

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <>
      <div
        role="progressbar"
        aria-label={t.projects.progress(done, total)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-(--tracking-muted)"
      >
        <div
          className="h-full rounded-full bg-(--tracking-fg)"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
      <span className="font-mono text-xs text-(--tracking-mfg)">
        {done}/{total}
      </span>
    </>
  );
}

function Mark({ tone, text }: { tone: "red" | "amber"; text: string }) {
  const color = tone === "red" ? "text-(--tracking-red)" : "text-(--tracking-amber)";
  return (
    <span className={`flex shrink-0 items-center gap-[5px] text-[12.5px] ${color}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

function ProjectLine({ project, onOpen }: { project: TodayProject; onOpen(projectId: string): void }) {
  return (
    <li className="relative flex h-[52px] items-center gap-3 border-t border-(--tracking-soft) px-[15px] first:border-t-0 hover:bg-(--tracking-hover)">
      <span
        aria-hidden
        className="grid size-[26px] shrink-0 place-items-center rounded-md text-xs font-semibold text-white"
        style={{ background: project.color }}
      >
        {project.name.charAt(0).toUpperCase()}
      </span>
      <div className="grid w-[150px] shrink-0 gap-0.5">
        <button
          type="button"
          onClick={() => onOpen(project.id)}
          className="truncate text-left text-[13px] leading-[1.2] font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {project.name}
        </button>
        {project.client === null ? (
          <span className="truncate font-mono text-[11.5px] leading-[1.2] text-(--tracking-dim)">
            {project.key}
          </span>
        ) : (
          <span className="truncate text-[11.5px] leading-[1.2] text-(--tracking-dim)">
            {t.projects.client(project.client)}
          </span>
        )}
      </div>
      {project.progress === null ? (
        <span className="flex items-center gap-1 text-[12.5px] font-medium">
          {t.projects.start}
          <ChevronRight aria-hidden size={13} className="text-(--tracking-mfg)" />
        </span>
      ) : (
        <Progress {...project.progress} />
      )}
      <span className="flex-1" />
      {project.progress !== null && (
        <span className="shrink-0 text-[12.5px] text-(--tracking-mfg)">{t.projects.open(project.open)}</span>
      )}
      {project.blocked > 0 && <Mark tone="red" text={t.projects.blocked(project.blocked)} />}
      {project.risk > 0 && <Mark tone="amber" text={t.projects.risk(project.risk)} />}
      {project.sprint !== null && (
        <span className="shrink-0 font-mono text-xs text-(--tracking-dim)">{project.sprint}</span>
      )}
    </li>
  );
}

export function ProjectsList({ projects, onOpen }: Props) {
  return (
    <section className="grid gap-3.5">
      <h2 className="text-xs font-medium tracking-[0.4px] text-(--tracking-dim) uppercase">
        {t.projects.title}
      </h2>
      <ul className="overflow-hidden rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)">
        {projects.map((project) => (
          <ProjectLine key={project.id} project={project} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
