import type { ProjectSummary } from "@kibo/schema";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Folder, Laptop } from "lucide-react";
import { frSkills } from "../i18n/fr-skills";

export type Destination = { source: "user" } | { source: "project"; projectId: string };

type Props = {
  label: string;
  value: Destination;
  projects: readonly ProjectSummary[];
  onChange(value: Destination): void;
};

const t = frSkills.newSkill;

export const destinationKey = (d: Destination): string =>
  d.source === "user" ? "user" : `project:${d.projectId}`;

export function DestinationField({ label, value, projects, onChange }: Props) {
  const pick = (key: string) => {
    if (key === "user") onChange({ source: "user" });
    const project = projects.find((p) => `project:${p.id}` === key);
    if (project) onChange({ source: "project", projectId: project.id });
  };
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={label}
        className="w-fit flex-wrap"
        value={destinationKey(value)}
        onValueChange={pick}
      >
        <ToggleGroupItem value="user" className="gap-1.5 px-3 text-xs">
          <Laptop aria-hidden className="size-3.5" />
          {t.computer}
        </ToggleGroupItem>
        {projects.map((p) => (
          <ToggleGroupItem
            key={p.id}
            value={`project:${p.id}`}
            disabled={p.folder === null}
            className="gap-1.5 px-3 text-xs"
            title={p.folder === null ? t.noFolder : undefined}
          >
            <Folder aria-hidden className="size-3.5" />
            {t.project(p.name)}
            {p.folder === null && <span className="text-muted-foreground">· {t.noFolder}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </fieldset>
  );
}
