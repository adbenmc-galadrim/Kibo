import type { CodeRequest, ComponentCall, RpcRequest } from "@kibo/schema";

const COMPONENT_WRITES: ReadonlySet<ComponentCall["kind"]> = new Set<ComponentCall["kind"]>([
  "run",
  "notes.write",
  "notes.create",
  "notes.rename",
  "notes.remove",
  "notes.attach",
  "questions.deliver",
]);

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
  req.method === "deliverAnswers" ||
  (req.method === "componentCall" && COMPONENT_WRITES.has(req.call.kind));

export const isCodeWrite = (req: CodeRequest): boolean => CODE_WRITES.has(req.method);

export const projectIdOf = (req: RpcRequest | CodeRequest): string | null =>
  "projectId" in req && typeof req.projectId === "string" ? req.projectId : null;
