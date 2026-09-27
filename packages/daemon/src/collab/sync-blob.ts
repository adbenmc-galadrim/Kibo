import { getKeyAllocator, projectDepthViolation } from "@kibo/core";
import { KiboError } from "@kibo/schema";
import { decodeImportBlobMeta, type ImportStatus, LoroDoc } from "loro-crdt";

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

export function refuseTooDeep(projectId: string, violation: string | null): void {
  if (violation) throw new KiboError("TOO_LARGE", `sync data for ${projectId} refused: ${violation}`);
}

export function importComplete(projectId: string, target: LoroDoc, bytes: Uint8Array): void {
  const status = importUpdateBlob(projectId, target, bytes);
  if (status.pending && status.pending.size > 0) {
    throw new KiboError("TOO_LARGE", `sync data for ${projectId} refused: its dependencies are missing`);
  }
}

export function assertSharedShape(projectId: string, doc: LoroDoc): void {
  if (doc.getMap("meta").get("folder") !== undefined) {
    throw new KiboError("INVALID_INPUT", `sync data for ${projectId} refused: it carries a local folder`);
  }
  if (getKeyAllocator(doc) !== "server") {
    throw new KiboError(
      "INVALID_INPUT",
      `sync data for ${projectId} refused: its keys are not server allocated`,
    );
  }
}

export function docFromServer(projectId: string, bytes: Uint8Array): LoroDoc {
  const doc = new LoroDoc();
  importComplete(projectId, doc, bytes);
  assertCompleteHistory(projectId, doc);
  assertSharedShape(projectId, doc);
  refuseTooDeep(projectId, projectDepthViolation(doc));
  return doc;
}
