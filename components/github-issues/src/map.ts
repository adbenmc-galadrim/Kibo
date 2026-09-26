import { type BindingConfig, type GithubIssueRef, remoteStatusId, type SyncedFields } from "@kibo/schema";
import type { GhIssue, ProjectItem, RestIssue } from "./remote";

const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
export const later = (a: string, b: string) => (a > b ? a : b);

export function optionOf(values: ProjectItem["fieldValues"]["nodes"], fieldId: string): string | null {
  return values.find((v) => v.field?.id === fieldId && v.optionId !== undefined)?.optionId ?? null;
}

export function fromRest(repo: string, r: RestIssue): GhIssue {
  return {
    nodeId: r.node_id,
    number: r.number,
    title: r.title.trim(),
    body: normalize(r.body ?? ""),
    closed: r.state === "closed",
    updatedAt: r.updated_at,
    url: r.html_url,
    repo,
    labels: r.labels.map((l) => (typeof l === "string" ? l : l.name)),
    optionId: null,
  };
}

export function fromItem(item: ProjectItem, fieldId: string): GhIssue | null {
  const c = item.content;
  if (!c?.id || c.number === undefined || !c.title || !c.state || !c.updatedAt || !c.url || !c.repository)
    return null;
  return {
    nodeId: c.id,
    number: c.number,
    title: c.title.trim(),
    body: normalize(c.body ?? ""),
    closed: c.state === "CLOSED",
    updatedAt: later(c.updatedAt, item.updatedAt),
    url: c.url,
    repo: c.repository.nameWithOwner,
    labels: c.labels?.nodes.map((l) => l.name) ?? [],
    optionId: optionOf(item.fieldValues.nodes, fieldId),
  };
}

export function toFields(r: GhIssue, c: BindingConfig): SyncedFields {
  const statusId = remoteStatusId(r.closed, r.optionId, c.project?.statusMap ?? null);
  return { title: r.title, description: r.body, statusId, closed: statusId === "done" };
}

export function toRef(r: GhIssue, bindingId: string): GithubIssueRef {
  return { kind: "github_issue", bindingId, repo: r.repo, number: r.number, nodeId: r.nodeId, url: r.url };
}
