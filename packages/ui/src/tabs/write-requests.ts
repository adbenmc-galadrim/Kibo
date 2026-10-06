import type { CodeRequest, RpcRequest } from "@kibo/schema";

const CODE_WRITES: ReadonlySet<CodeRequest["method"]> = new Set<CodeRequest["method"]>([
  "writeFile",
  "stageAll",
  "stageFiles",
  "stageHunk",
  "unstageAll",
  "unstageFiles",
  "commit",
  "reword",
  "undoCommit",
  "discardChanges",
  "push",
  "createPr",
]);

export const isProjectWrite = (req: RpcRequest): boolean =>
  req.method === "command" || (req.method === "componentCall" && req.call.kind === "run");

export const isCodeWrite = (req: CodeRequest): boolean => CODE_WRITES.has(req.method);

export const projectIdOf = (req: RpcRequest | CodeRequest): string | null =>
  "projectId" in req && typeof req.projectId === "string" ? req.projectId : null;
