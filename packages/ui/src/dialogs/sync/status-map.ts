import { BindingConfig, type GithubProject, type RepoSlug, type Status, type StatusMap } from "@kibo/schema";

export const SYNCABLE_COMPONENTS: readonly string[] = ["kanban", "tickets"];
export type SyncForm = {
  repo: RepoSlug | null;
  project: GithubProject | null;
  statusMap: StatusMap;
  labels: string;
  importClosed: boolean;
};
export const EMPTY_SYNC_FORM: SyncForm = {
  repo: null,
  project: null,
  statusMap: {},
  labels: "",
  importClosed: false,
};

const norm = (s: string) => s.trim().toLocaleLowerCase("fr");

export function prefillStatusMap(workflow: Status[], options: { id: string; name: string }[]): StatusMap {
  const map: StatusMap = {};
  for (const s of workflow) {
    const o = options.find((x) => norm(x.name) === norm(s.label));
    if (o) map[s.id] = o.id;
  }
  return map;
}

export function parseLabels(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    ),
  ].slice(0, 20);
}

export function toBindingConfig(f: SyncForm): BindingConfig | null {
  if (f.repo === null) return null;
  const field = f.project?.statusField ?? null;
  return BindingConfig.parse({
    repo: f.repo,
    project:
      f.project && field
        ? {
            owner: f.project.owner,
            number: f.project.number,
            nodeId: f.project.nodeId,
            statusFieldId: field.id,
            statusMap: f.statusMap,
          }
        : null,
    importClosed: f.importClosed,
    labels: parseLabels(f.labels),
  });
}
