import { BindingConfig, GITHUB_GRAPHQL, KiboError, type PushOp, type SyncedFields } from "@kibo/schema";
import { defineAdapter } from "@kibo/sdk/adapter";
import { z } from "zod";
import { readProjectCursor, readRestCursor } from "./cursor";
import { fromItem, fromRest, later, toFields, toRef } from "./map";
import { addItem, currentItem, setStatus } from "./project";
import { GhIssue, ProjectItemsData, RestIssue } from "./remote";
import { type Ctx, call, graphql } from "./rest";

const PER_PAGE = 100;
const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
type Project = NonNullable<Ctx["config"]["project"]>;

async function pullRest(ctx: Ctx, raw: string | null) {
  const cursor = readRestCursor(raw);
  const q = new URLSearchParams({
    state: "all",
    sort: "updated",
    direction: "asc",
    per_page: String(PER_PAGE),
    page: String(cursor.page),
  });
  if (cursor.since) q.set("since", cursor.since);
  const page = await call(ctx, "GET", `/repos/${ctx.config.repo}/issues?${q}`, z.array(RestIssue));
  const items = page.filter((i) => i.pull_request === undefined).map((i) => fromRest(ctx.config.repo, i));
  const max = page.reduce((m, i) => later(m, i.updated_at), cursor.since ?? "") || null;
  if (page.length < PER_PAGE)
    return { items, cursor: JSON.stringify({ mode: "rest", since: max, page: 1 }), more: false };
  if (max === cursor.since)
    return { items, cursor: JSON.stringify({ ...cursor, page: cursor.page + 1 }), more: true };
  return { items, cursor: JSON.stringify({ mode: "rest", since: max, page: 1 }), more: true };
}

async function pullProject(ctx: Ctx, project: Project, raw: string | null) {
  const cursor = readProjectCursor(raw);
  const d = await graphql(
    ctx,
    GITHUB_GRAPHQL.projectItems,
    { projectId: project.nodeId, after: cursor.after },
    ProjectItemsData,
  );
  if (!d.node) throw new KiboError("REMOTE_NOT_FOUND", "project not found");
  const mine = d.node.items.nodes.flatMap((n) => {
    const issue = fromItem(n, project.statusFieldId);
    return issue && issue.repo === ctx.config.repo ? [issue] : [];
  });
  const items = mine.filter((i) => cursor.since === null || i.updatedAt >= cursor.since);
  const max = mine.reduce((m, i) => later(m, i.updatedAt), cursor.max ?? "") || null;
  const { hasNextPage, endCursor } = d.node.items.pageInfo;
  if (hasNextPage)
    return {
      items,
      cursor: JSON.stringify({ mode: "project", since: cursor.since, after: endCursor, max }),
      more: true,
    };
  return {
    items,
    cursor: JSON.stringify({ mode: "project", since: max ?? cursor.since, after: null, max: null }),
    more: false,
  };
}

async function adopt(ctx: Ctx, fields: SyncedFields, since: string) {
  const { login } = await call(ctx, "GET", "/user", z.object({ login: z.string() }));
  const q = new URLSearchParams({ state: "all", creator: login, since, per_page: String(PER_PAGE) });
  const recent = await call(ctx, "GET", `/repos/${ctx.config.repo}/issues?${q}`, z.array(RestIssue));
  const match = recent.find(
    (i) =>
      i.pull_request === undefined &&
      i.title.trim() === fields.title &&
      normalize(i.body ?? "") === fields.description,
  );
  return match ? fromRest(ctx.config.repo, match) : null;
}

async function applyStatus(
  ctx: Ctx,
  project: Project,
  issue: GhIssue,
  itemId: string,
  currentOption: string | null,
  statusId: SyncedFields["statusId"] | undefined,
): Promise<GhIssue> {
  const option = statusId === undefined ? undefined : project.statusMap[statusId];
  if (option === undefined) return { ...issue, optionId: currentOption };
  await setStatus(ctx, project, itemId, option);
  return { ...issue, optionId: option };
}

async function create(ctx: Ctx, op: Extract<PushOp, { kind: "create" }>): Promise<GhIssue> {
  const repo = ctx.config.repo;
  let issue =
    (op.since === null ? null : await adopt(ctx, op.fields, op.since)) ??
    fromRest(
      repo,
      await call(ctx, "POST", `/repos/${repo}/issues`, RestIssue, {
        title: op.fields.title,
        body: op.fields.description,
        ...(ctx.config.labels.length > 0 && { labels: ctx.config.labels }),
      }),
    );
  if (op.fields.closed && !issue.closed) {
    issue = fromRest(
      repo,
      await call(ctx, "PATCH", `/repos/${repo}/issues/${issue.number}`, RestIssue, { state: "closed" }),
    );
  }
  const project = ctx.config.project;
  if (!project) return issue;
  const itemId = await addItem(ctx, project, issue.nodeId);
  return applyStatus(ctx, project, issue, itemId, null, op.fields.statusId);
}

async function update(ctx: Ctx, op: Extract<PushOp, { kind: "update" }>): Promise<GhIssue> {
  const path = `/repos/${ctx.config.repo}/issues/${op.remoteId}`;
  const patch = {
    ...(op.patch.title !== undefined && { title: op.patch.title }),
    ...(op.patch.description !== undefined && { body: op.patch.description }),
    ...(op.patch.closed !== undefined && { state: op.patch.closed ? "closed" : "open" }),
  };
  const raw =
    Object.keys(patch).length > 0
      ? await call(ctx, "PATCH", path, RestIssue, patch)
      : await call(ctx, "GET", path, RestIssue);
  const issue = fromRest(ctx.config.repo, raw);
  const project = ctx.config.project;
  if (!project) return issue;
  const current = await currentItem(ctx, project, issue.number);
  const itemId = current.itemId ?? (await addItem(ctx, project, current.issueId));
  return applyStatus(ctx, project, issue, itemId, current.optionId, op.patch.statusId);
}

export const githubIssuesAdapter = defineAdapter<GhIssue, BindingConfig>({
  id: "github-issues",
  remote: GhIssue,
  config: BindingConfig,
  pull: (ctx, cursor) =>
    ctx.config.project ? pullProject(ctx, ctx.config.project, cursor) : pullRest(ctx, cursor),
  push: (ctx, op) => (op.kind === "create" ? create(ctx, op) : update(ctx, op)),
  map: {
    remoteId: (r) => String(r.number),
    updatedAt: (r) => r.updatedAt,
    toFields,
    toRef,
    labels: (r) => r.labels,
  },
});
