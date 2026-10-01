import {
  type DraftAttachmentInput,
  ICON_MIMES,
  type IconMime,
  MAX_DRAFT_ATTACHMENTS,
  MAX_ICON_BASE64,
  MAX_ICON_BYTES,
} from "@kibo/schema";
import { bytesToBase64, sniffIconMime } from "../dialogs/icon-file";

export type AttachmentRefusal = "count" | "format" | "too-large";
export type AttachmentResult =
  | { ok: true; list: DraftAttachmentInput[] }
  | { ok: false; refusal: AttachmentRefusal };
export type ReadResult = { ok: true; item: DraftAttachmentInput } | { ok: false; refusal: AttachmentRefusal };

const MAX_NAME = 64;
const EXTENSIONS: Record<IconMime, readonly string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif|tiff?|svg)$/i;

const cleanStem = (stem: string): string =>
  stem
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-");

const trimEdges = (stem: string): string => stem.replace(/^[^A-Za-z0-9]+/, "").replace(/[-._]+$/, "");

const withExtension = (stem: string, extension: string): string =>
  `${trimEdges(trimEdges(stem).slice(0, MAX_NAME - extension.length)) || "image"}${extension}`;

export function attachmentName(fileName: string, mime: IconMime): string {
  const original = IMAGE_EXTENSION.exec(fileName)?.[0].toLowerCase() ?? "";
  const allowed = EXTENSIONS[mime];
  const extension = allowed.includes(original) ? original : (allowed[0] ?? ".png");
  return withExtension(cleanStem(fileName.slice(0, fileName.length - original.length)), extension);
}

const splitName = (name: string): { stem: string; extension: string } => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { stem: name.slice(0, dot), extension: name.slice(dot) } : { stem: name, extension: "" };
};

const uniqueName = (taken: readonly string[], name: string): string => {
  if (!taken.includes(name)) return name;
  const { stem, extension } = splitName(name);
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${stem.slice(0, MAX_NAME - extension.length - suffix.length)}${suffix}${extension}`;
    if (!taken.includes(candidate)) return candidate;
  }
};

export const attachmentBytes = ({ data }: Pick<DraftAttachmentInput, "data">): number =>
  Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);

const isIconMime = (mime: string): mime is IconMime => (ICON_MIMES as readonly string[]).includes(mime);

export function addAttachment(list: DraftAttachmentInput[], item: DraftAttachmentInput): AttachmentResult {
  if (list.length >= MAX_DRAFT_ATTACHMENTS) return { ok: false, refusal: "count" };
  if (!isIconMime(item.mime)) return { ok: false, refusal: "format" };
  if (item.data.length > MAX_ICON_BASE64 || attachmentBytes(item) > MAX_ICON_BYTES) {
    return { ok: false, refusal: "too-large" };
  }
  const name = uniqueName(
    list.map((a) => a.name),
    item.name,
  );
  return { ok: true, list: [...list, { ...item, name }] };
}

export async function readAttachment(file: File): Promise<ReadResult> {
  if (file.size > MAX_ICON_BYTES) return { ok: false, refusal: "too-large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffIconMime(bytes);
  if (mime === null) return { ok: false, refusal: "format" };
  return { ok: true, item: { name: attachmentName(file.name, mime), mime, data: bytesToBase64(bytes) } };
}

export const imageFiles = (transfer: { files: ArrayLike<File> | null } | null): File[] =>
  Array.from(transfer?.files ?? []);
