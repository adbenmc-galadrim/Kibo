import type { ProjectSummary } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { effectiveProject, PROJECT_ALL } from "./project-filter";

type Props = {
  projects: readonly ProjectSummary[];
  value: string;
  onChange(value: string): void;
};

function ProjectSwatch({ color }: { color: string }) {
  return (
    <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
  );
}

export function ProjectFilter({ projects, value, onChange }: Props) {
  const t = frAgentsPage.project;
  const current = effectiveProject(value, projects);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={t.label} className="h-8 gap-1.5 px-3 text-xs font-normal">
          {current && <ProjectSwatch color={current.color} />}
          {t.trigger(current?.name ?? null)}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current?.id ?? PROJECT_ALL} onValueChange={onChange}>
          <DropdownMenuRadioItem value={PROJECT_ALL}>{t.all}</DropdownMenuRadioItem>
          {projects.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="gap-2">
              <ProjectSwatch color={p.color} />
              {p.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
