import type { CodeRequest, ComponentCall, RpcRequest } from "@kibo/schema";

const PROJECT_AGENT_WRITES: ReadonlySet<RpcRequest["method"]> = new Set<RpcRequest["method"]>([
  "sendProjectAgentMessage",
  "decideBatch",
  "resetProjectAgent",
]);

const COMPONENT_WRITES: ReadonlySet<ComponentCall["kind"]> = new Set<ComponentCall["kind"]>(["run"]);

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
  req.method === "command" ||
  PROJECT_AGENT_WRITES.has(req.method) ||
  (req.method === "componentCall" && COMPONENT_WRITES.has(req.call.kind));

export const isCodeWrite = (req: CodeRequest): boolean => CODE_WRITES.has(req.method);

export const projectIdOf = (req: RpcRequest | CodeRequest): string | null =>
  "projectId" in req && typeof req.projectId === "string" ? req.projectId : null;
