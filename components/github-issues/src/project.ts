import { GITHUB_GRAPHQL, KiboError } from "@kibo/schema";
import { optionOf } from "./map";
import { AddItemData, IssueItemsData, SetStatusData } from "./remote";
import { type Ctx, graphql } from "./rest";

type Project = NonNullable<Ctx["config"]["project"]>;

export async function addItem(ctx: Ctx, project: Project, contentId: string): Promise<string> {
  const d = await graphql(ctx, GITHUB_GRAPHQL.addItem, { projectId: project.nodeId, contentId }, AddItemData);
  return d.addProjectV2ItemById.item.id;
}

export async function setStatus(ctx: Ctx, project: Project, itemId: string, optionId: string): Promise<void> {
  await graphql(
    ctx,
    GITHUB_GRAPHQL.setStatus,
    { projectId: project.nodeId, itemId, fieldId: project.statusFieldId, optionId },
    SetStatusData,
  );
}

export async function currentItem(
  ctx: Ctx,
  project: Project,
  number: number,
): Promise<{ issueId: string; itemId: string | null; optionId: string | null }> {
  const [owner, name] = ctx.config.repo.split("/");
  const d = await graphql(ctx, GITHUB_GRAPHQL.issueItems, { owner, name, number }, IssueItemsData);
  const issue = d.repository?.issue;
  if (!issue) throw new KiboError("REMOTE_NOT_FOUND", `issue ${number} not found`);
  const item = issue.projectItems.nodes.find((n) => n.project.id === project.nodeId);
  return {
    issueId: issue.id,
    itemId: item?.id ?? null,
    optionId: item ? optionOf(item.fieldValues.nodes, project.statusFieldId) : null,
  };
}
