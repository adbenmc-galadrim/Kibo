import type { RpcRequest } from "@kibo/schema";

export const COMPONENT_METHODS = [
  "listComponents",
  "componentCall",
  "approveComponent",
  "revokeComponent",
  "rehashComponent",
  "previewPublish",
  "publishComponent",
  "updateInstance",
  "uninstallComponent",
  "listDrafts",
  "getNotesDir",
  "setNotesDir",
  "getRuntimeInfo",
  "installCli",
  "cliStatus",
  "reportComponentRefusal",
  "listAssets",
  "beginAssetUpload",
  "appendAssetUpload",
  "finishAssetUpload",
  "cancelAssetUpload",
  "removeAsset",
  "getFilesDir",
  "setFilesDir",
] as const satisfies readonly RpcRequest["method"][];

export type ComponentRequest = Extract<RpcRequest, { method: (typeof COMPONENT_METHODS)[number] }>;
export type ShellRequest = Exclude<RpcRequest, ComponentRequest>;

const METHODS: ReadonlySet<string> = new Set(COMPONENT_METHODS);

export const isComponentRequest = (req: RpcRequest): req is ComponentRequest => METHODS.has(req.method);
