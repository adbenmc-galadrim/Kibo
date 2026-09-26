import type { GithubProject, Status, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { RepoList } from "./RepoList";
import { prefillStatusMap, type SyncForm } from "./status-map";

type Props = {
  workflow: Status[];
  value: SyncForm;
  onChange(f: SyncForm): void;
  onError(message: string): void;
};
type Option = { id: string; name: string };
const t = fr.integrations.source;
const NONE = "__none";

function StatusRow({
  status,
  options,
  value,
  onChange,
}: {
  status: Status;
  options: Option[];
  value: string;
  onChange(v: string): void;
}) {
  const id = useId();
  return (
    <>
      <Label htmlFor={id} className="flex items-center gap-2 font-normal">
        <StatusDot statusId={status.id} />
        {status.label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t.unmapped}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function useProjects(repo: string | null, onError: (message: string) => void): GithubProject[] {
  const [projects, setProjects] = useState<GithubProject[]>([]);
  useEffect(() => {
    setProjects([]);
    if (repo === null) return;
    let live = true;
    client
      .rpc({ method: "listGithubProjects", repo })
      .then((p) => {
        if (live) setProjects(p);
      })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [repo, onError]);
  return projects;
}

export function SyncSourceForm({ workflow, value, onChange, onError }: Props) {
  const ids = { repo: useId(), project: useId(), labels: useId(), closed: useId() };
  const projects = useProjects(value.repo, onError);
  const options = value.project?.statusField?.options ?? null;
  const pickProject = (nodeId: string) => {
    const project = projects.find((p) => p.nodeId === nodeId) ?? null;
    const statusMap = project?.statusField ? prefillStatusMap(workflow, project.statusField.options) : {};
    onChange({ ...value, project, statusMap });
  };
  const setOption = (status: StatusId, option: string) => {
    const statusMap = { ...value.statusMap };
    if (option === NONE) delete statusMap[status];
    else statusMap[status] = option;
    onChange({ ...value, statusMap });
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p id={ids.repo} className="text-sm font-medium">
          {t.repo}
        </p>
        <RepoList
          labelledBy={ids.repo}
          value={value.repo}
          onChange={(r) => onChange({ ...value, repo: r.fullName, project: null, statusMap: {} })}
          onError={onError}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.project}>{t.project}</Label>
        <Select
          value={value.project?.nodeId ?? NONE}
          onValueChange={(v) => pickProject(v === NONE ? "" : v)}
          disabled={value.repo === null}
        >
          <SelectTrigger id={ids.project} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t.noProject}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.nodeId} value={p.nodeId} disabled={p.statusField === null}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {options && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t.statusMap}</legend>
          <p className="text-xs text-muted-foreground">{t.statusMapHelp}</p>
          <div className="grid grid-cols-2 items-center gap-2">
            {workflow.map((s) => (
              <StatusRow
                key={s.id}
                status={s}
                options={options}
                value={value.statusMap[s.id] ?? NONE}
                onChange={(o) => setOption(s.id, o)}
              />
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-2">
        <Label htmlFor={ids.labels}>{t.labels}</Label>
        <Input
          id={ids.labels}
          value={value.labels}
          onChange={(e) => onChange({ ...value, labels: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.labelsHelp}</p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={ids.closed}
          checked={value.importClosed}
          onCheckedChange={(c) => onChange({ ...value, importClosed: c === true })}
        />
        <Label htmlFor={ids.closed}>{t.importClosed}</Label>
      </div>
    </div>
  );
}
