import { RepoSlug, WebUrl } from "@kibo/schema";
import { z } from "zod";

export const GhIssue = z.object({
  nodeId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string(),
  closed: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }),
  url: WebUrl,
  repo: RepoSlug,
  labels: z.array(z.string()),
  optionId: z.string().nullable(),
});
export type GhIssue = z.infer<typeof GhIssue>;

export const RestIssue = z.object({
  node_id: z.string(),
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  updated_at: z.string(),
  html_url: z.string(),
  labels: z.array(z.union([z.string(), z.object({ name: z.string() })])),
  pull_request: z.unknown().optional(),
  user: z.object({ login: z.string() }).nullable().optional(),
});
export type RestIssue = z.infer<typeof RestIssue>;

const FieldValue = z.object({
  optionId: z.string().optional(),
  field: z.object({ id: z.string().optional() }).optional(),
});
export const ItemContent = z.object({
  id: z.string().optional(),
  number: z.number().int().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["OPEN", "CLOSED"]).optional(),
  updatedAt: z.string().optional(),
  url: z.string().optional(),
  repository: z.object({ nameWithOwner: z.string() }).optional(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }).optional(),
});
export const ProjectItem = z.object({
  id: z.string(),
  updatedAt: z.string(),
  fieldValues: z.object({ nodes: z.array(FieldValue) }),
  content: ItemContent.nullable(),
});
export type ProjectItem = z.infer<typeof ProjectItem>;
export const ProjectItemsData = z.object({
  node: z
    .object({
      items: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(ProjectItem),
      }),
    })
    .nullable(),
});
export const IssueItemsData = z.object({
  repository: z
    .object({
      issue: z
        .object({
          id: z.string(),
          projectItems: z.object({
            nodes: z.array(
              z.object({
                id: z.string(),
                project: z.object({ id: z.string() }),
                fieldValues: z.object({ nodes: z.array(FieldValue) }),
              }),
            ),
          }),
        })
        .nullable(),
    })
    .nullable(),
});
export const AddItemData = z.object({
  addProjectV2ItemById: z.object({ item: z.object({ id: z.string() }) }),
});
export const SetStatusData = z.object({
  updateProjectV2ItemFieldValue: z.object({ projectV2Item: z.object({ id: z.string() }) }),
});
