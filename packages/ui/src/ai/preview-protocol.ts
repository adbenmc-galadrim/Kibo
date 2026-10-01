import { ComponentCall, ComponentManifest } from "@kibo/schema";

export const DEMO_VIEWER = "adam";

export type PreviewRequest =
  | { type: "init"; manifest: ComponentManifest }
  | { type: "call"; id: number; call: ComponentCall };

export type PreviewReply =
  | { type: "result"; id: number; result: unknown }
  | { type: "error"; id: number; code: string; message: string }
  | { type: "changed" };

export type PreviewPort = {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (e: MessageEvent) => void): void;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function parsePreviewRequest(data: unknown): PreviewRequest | null {
  if (!isRecord(data)) return null;
  if (data.type === "init") {
    const manifest = ComponentManifest.safeParse(data.manifest);
    return manifest.success ? { type: "init", manifest: manifest.data } : null;
  }
  if (data.type === "call" && isId(data.id)) {
    const call = ComponentCall.safeParse(data.call);
    return call.success ? { type: "call", id: data.id, call: call.data } : null;
  }
  return null;
}

export function parsePreviewReply(data: unknown): PreviewReply | null {
  if (!isRecord(data)) return null;
  if (data.type === "changed") return { type: "changed" };
  if (data.type === "result" && isId(data.id)) return { type: "result", id: data.id, result: data.result };
  if (
    data.type === "error" &&
    isId(data.id) &&
    typeof data.code === "string" &&
    typeof data.message === "string"
  )
    return { type: "error", id: data.id, code: data.code, message: data.message };
  return null;
}
