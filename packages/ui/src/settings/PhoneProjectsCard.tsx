import type { ProjectSummary, RemoteStatus } from "@kibo/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Label } from "@kibo/sdk/ui/label";
import { useId, useState } from "react";
import { client } from "../api";
import { frPhone } from "../i18n/fr-phone";
import { useRpcQuery } from "../state/use-rpc-query";
import { describeError } from "./use-remote-status";

const t = frPhone.projects;

type Props = { selected: readonly string[]; onSaved(status: RemoteStatus): void };

const toggledProjects = (selected: readonly string[], id: string, on: boolean): string[] =>
  on ? [...selected.filter((p) => p !== id), id] : selected.filter((p) => p !== id);

function ProjectRow(p: {
  project: ProjectSummary;
  checked: boolean;
  busy: boolean;
  onToggle(on: boolean): void;
}) {
  const id = useId();
  return (
    <li className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={p.checked}
        disabled={p.busy}
        onCheckedChange={(value) => p.onToggle(value === true)}
      />
      <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: p.project.color }} />
      <Label htmlFor={id} className="font-normal">
        {p.project.name}
      </Label>
      <span className="ml-auto text-xs text-muted-foreground">{p.project.key}</span>
    </li>
  );
}

function ProjectList({ projects, ...rest }: { projects: ProjectSummary[] | null } & Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (projects === null) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  if (projects.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  const toggle = async (projectId: string, on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const projectIds = toggledProjects(rest.selected, projectId, on);
      rest.onSaved(await client.rpc({ method: "remote.setProjects", projectIds }));
    } catch (e) {
      setError(t.failed(describeError(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ul className="grid gap-2.5">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            checked={rest.selected.includes(project.id)}
            busy={busy}
            onToggle={(on) => void toggle(project.id, on)}
          />
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

export function PhoneProjectsCard(props: Props) {
  const titleId = useId();
  const projects = useRpcQuery({ method: "listProjects" }, []).data;
  return (
    <Card role="region" aria-labelledby={titleId} className="gap-4">
      <CardHeader>
        <CardTitle id={titleId}>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectList projects={projects} {...props} />
      </CardContent>
    </Card>
  );
}
