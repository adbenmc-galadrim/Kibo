import { KiboError } from "@kibo/schema";
import { decodeImportBlobMeta, type ImportStatus, type LoroDoc } from "loro-crdt";

const undecodable = (projectId: string, e: unknown) =>
  new KiboError("INVALID_INPUT", `sync data for ${projectId} cannot be decoded: ${String(e)}`);

export function importUpdateBlob(projectId: string, target: LoroDoc, bytes: Uint8Array): ImportStatus {
  let mode: string;
  try {
    mode = decodeImportBlobMeta(bytes, true).mode;
  } catch (e) {
    throw undecodable(projectId, e);
  }
  if (mode !== "update") {
    throw new KiboError(
      "INVALID_INPUT",
      `sync data for ${projectId} refused: ${mode} blobs are not accepted`,
    );
  }
  try {
    return target.import(bytes);
  } catch (e) {
    throw undecodable(projectId, e);
  }
}

export function assertCompleteHistory(projectId: string, doc: LoroDoc): void {
  if (doc.isShallow()) {
    throw new KiboError("INVALID_INPUT", `sync data for ${projectId} refused: its history is truncated`);
  }
}
