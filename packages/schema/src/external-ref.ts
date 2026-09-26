import { z } from "zod";
import { FigmaNodeRef, GithubIssueRef, McpItemRef, WebUrl } from "./integrations";

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const GithubPrRef = z.object({
  kind: z.literal("github_pr"),
  url: WebUrl,
  number: z.number().int().positive(),
  state: PrState,
});
export type GithubPrRef = z.infer<typeof GithubPrRef>;

export const ExternalRef = z.discriminatedUnion("kind", [
  GithubPrRef,
  GithubIssueRef,
  FigmaNodeRef,
  McpItemRef,
]);
export type ExternalRef = z.infer<typeof ExternalRef>;
export const ExternalRefKind = z.enum(["github_pr", "github_issue", "figma_node", "mcp_item"]);
export type ExternalRefKind = z.infer<typeof ExternalRefKind>;

export function externalRefKey(ref: ExternalRef): string {
  switch (ref.kind) {
    case "github_pr":
      return ref.url;
    case "github_issue":
      return ref.bindingId;
    case "figma_node":
      return `${ref.fileKey}:${ref.nodeId}`;
    case "mcp_item":
      return `${ref.server}:${ref.itemId}`;
  }
}

export function externalRefTarget(ref: ExternalRef): string | null {
  if (ref.kind !== "github_issue") return `${ref.kind}:${externalRefKey(ref)}`;
  return ref.number === null ? null : `github_issue:${ref.bindingId}#${ref.number}`;
}
