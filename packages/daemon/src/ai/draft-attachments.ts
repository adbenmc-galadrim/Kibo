import { chmodSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type DraftAttachment,
  type DraftAttachmentInput,
  DraftAttachmentName,
  type IconMime,
  KiboError,
  MAX_DRAFT_ATTACHMENTS,
  MAX_DRAFT_ATTACHMENTS_TOTAL,
} from "@kibo/schema";
import { decodeIcon } from "../icons/decode-icon";
import { assertRealDir, guarded, present, removeTree } from "./draft-fs";

type Decoded = { attachment: DraftAttachment; bytes: Uint8Array };

const EXTENSIONS: Record<IconMime, readonly string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
};

const fileName = (n: number, name: string) => `${n}-${name}`;
const extensionOf = (name: string) => name.split(".").slice(1).at(-1)?.toLowerCase() ?? "";
const isExisting = (e: unknown) => e instanceof Error && "code" in e && e.code === "EEXIST";

function decodeAll(inputs: readonly DraftAttachmentInput[]): Decoded[] {
  if (inputs.length > MAX_DRAFT_ATTACHMENTS)
    throw new KiboError("INVALID_INPUT", `at most ${MAX_DRAFT_ATTACHMENTS} images per request`);
  return inputs.map((input) => {
    if (!DraftAttachmentName.safeParse(input.name).success)
      throw new KiboError("INVALID_INPUT", "an image name has invalid characters");
    const { mime, bytes } = decodeIcon(input);
    if (!EXTENSIONS[mime].includes(extensionOf(input.name)))
      throw new KiboError("INVALID_INPUT", `the name ${input.name} does not end like a ${mime} image`);
    return { attachment: { name: input.name, mime, bytes: bytes.byteLength }, bytes };
  });
}

export function checkAttachments(inputs: readonly DraftAttachmentInput[]): void {
  decodeAll(inputs);
}

function privateDir(dir: string): boolean {
  const created = !present(dir);
  if (created) {
    mkdirSync(dirname(dir), { recursive: true, mode: 0o700 });
    mkdirSync(dir, { mode: 0o700 });
  }
  assertRealDir(dir);
  chmodSync(dir, 0o700);
  return created;
}

function writeAll(dir: string, decoded: Decoded[], first: number): DraftAttachment[] {
  const written: string[] = [];
  try {
    return decoded.map(({ attachment, bytes }, i) => {
      const target = join(dir, fileName(first + i, attachment.name));
      try {
        writeFileSync(target, bytes, { mode: 0o600, flag: "wx" });
      } catch (e) {
        if (!isExisting(e)) removeTree(target);
        throw e;
      }
      written.push(target);
      return attachment;
    });
  } catch (e) {
    for (const file of written) removeTree(file);
    throw e;
  }
}

export function writeAttachments(
  dir: string,
  inputs: readonly DraftAttachmentInput[],
  existing: readonly DraftAttachment[],
): DraftAttachment[] {
  const decoded = decodeAll(inputs);
  if (existing.length + decoded.length > MAX_DRAFT_ATTACHMENTS_TOTAL)
    throw new KiboError("INVALID_INPUT", `a draft keeps at most ${MAX_DRAFT_ATTACHMENTS_TOTAL} images`);
  if (decoded.length === 0) return [];
  return guarded("write draft images", () => {
    const created = privateDir(dir);
    try {
      return writeAll(dir, decoded, existing.length + 1);
    } catch (e) {
      if (created && readdirSync(dir).length === 0) removeTree(dir);
      throw e;
    }
  });
}

export const attachmentPaths = (dir: string, list: readonly DraftAttachment[]): string[] =>
  list.map((a, i) => join(dir, fileName(i + 1, a.name)));

export function removeAttachmentFiles(paths: readonly string[]): void {
  guarded("remove draft images", () => {
    for (const file of paths) removeTree(file);
  });
}
