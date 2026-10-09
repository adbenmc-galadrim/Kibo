import { z } from "zod";
import { PenpotBoardRef } from "./design";
import { GitBranchRef, ImportRef } from "./git-branch";
import { FigmaNodeRef, GithubIssueRef, McpItemRef, WebUrl } from "./integrations";

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const GithubPrRef = z.object({
  kind: z.literal("github_pr"),
  url: WebUrl,
  number: z.number().int().positive(),
  state: PrState,
  base: z.string().nullable().default(null),
  head: z.string().nullable().default(null),
});
export type GithubPrRef = z.infer<typeof GithubPrRef>;

export const ExternalRef = z.discriminatedUnion("kind", [
  GithubPrRef,
  GithubIssueRef,
  FigmaNodeRef,
  PenpotBoardRef,
  McpItemRef,
  GitBranchRef,
  ImportRef,
]);
export type ExternalRef = z.infer<typeof ExternalRef>;
export const ExternalRefKind = z.enum([
  "github_pr",
  "github_issue",
  "figma_node",
  "penpot_board",
  "mcp_item",
  "git_branch",
  "import_ref",
]);
export type ExternalRefKind = z.infer<typeof ExternalRefKind>;

export function externalRefKey(ref: ExternalRef): string {
  switch (ref.kind) {
    case "github_pr":
      return ref.url;
    case "github_issue":
      return ref.bindingId;
    case "figma_node":
      return `${ref.fileKey}:${ref.nodeId}`;
    case "penpot_board":
      return `${ref.fileId}/${ref.pageId}/${ref.boardId}`;
    case "mcp_item":
      return `${ref.server}:${ref.itemId}`;
    case "git_branch":
      return "branch";
    case "import_ref":
      return `${ref.source}:${ref.id}`;
  }
}

export function externalRefTarget(ref: ExternalRef): string | null {
  if (ref.kind !== "github_issue") return `${ref.kind}:${externalRefKey(ref)}`;
  return ref.number === null ? null : `github_issue:${ref.bindingId}#${ref.number}`;
}

export const branchRefOf = (refs: readonly ExternalRef[]): GitBranchRef | null =>
  refs.find((r): r is GitBranchRef => r.kind === "git_branch") ?? null;
