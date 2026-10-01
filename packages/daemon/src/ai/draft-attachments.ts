import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type DraftAttachment,
  type DraftAttachmentInput,
  DraftAttachmentName,
  KiboError,
  MAX_DRAFT_ATTACHMENTS,
} from "@kibo/schema";
import { decodeIcon } from "../icons/decode-icon";
import { assertRealDir, guarded, present, removeTree } from "./draft-fs";

type Decoded = { attachment: DraftAttachment; bytes: Uint8Array };

const fileName = (n: number, name: string) => `${n}-${name}`;

function decodeAll(inputs: readonly DraftAttachmentInput[]): Decoded[] {
  if (inputs.length > MAX_DRAFT_ATTACHMENTS)
    throw new KiboError("INVALID_INPUT", `at most ${MAX_DRAFT_ATTACHMENTS} images per request`);
  return inputs.map((input) => {
    if (!DraftAttachmentName.safeParse(input.name).success)
      throw new KiboError("INVALID_INPUT", "an image name has invalid characters");
    const { mime, bytes } = decodeIcon(input);
    return { attachment: { name: input.name, mime, bytes: bytes.byteLength }, bytes };
  });
}

export function checkAttachments(inputs: readonly DraftAttachmentInput[]): void {
  decodeAll(inputs);
}

function privateDir(dir: string): void {
  if (!present(dir)) {
    mkdirSync(dirname(dir), { recursive: true, mode: 0o700 });
    mkdirSync(dir, { mode: 0o700 });
  }
  assertRealDir(dir);
  chmodSync(dir, 0o700);
}

export function writeAttachments(
  dir: string,
  inputs: readonly DraftAttachmentInput[],
  existing: readonly DraftAttachment[],
): DraftAttachment[] {
  const decoded = decodeAll(inputs);
  if (decoded.length === 0) return [];
  return guarded("write draft images", () => {
    privateDir(dir);
    const written: string[] = [];
    try {
      return decoded.map(({ attachment, bytes }, i) => {
        const target = join(dir, fileName(existing.length + i + 1, attachment.name));
        writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
        written.push(target);
        return attachment;
      });
    } catch (e) {
      for (const file of written) removeTree(file);
      throw e;
    }
  });
}

export const attachmentPaths = (dir: string, list: readonly DraftAttachment[]): string[] =>
  list.map((a, i) => join(dir, fileName(i + 1, a.name)));
