import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, sep } from "node:path";
import { QUESTION_IMAGE_LIMITS, type QuestionImage } from "@kibo/schema";
import { imageSize } from "./image-size";

export type ImageFs = {
  realpath(path: string): string;
  stat(path: string): { size: number; isFile: boolean };
  readFile(path: string): Uint8Array;
  mkdir(dir: string): void;
  writeFile(path: string, bytes: Uint8Array): void;
};

export const nodeImageFs: ImageFs = {
  realpath: (path) => realpathSync(path),
  stat(path) {
    const stat = lstatSync(path);
    return { size: stat.size, isFile: stat.isFile() };
  },
  readFile: (path) => readFileSync(path),
  mkdir(dir) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  },
  writeFile(path, bytes) {
    writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
  },
};

export type QuestionImageFile = { bytes: Uint8Array; mime: string };
export type PreparedImage = { image: QuestionImage; ext: ImageExtension; bytes: Uint8Array };
type ImageExtension = (typeof QUESTION_IMAGE_LIMITS.extensions)[number];

const MIME: Record<ImageExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const IMAGE_NAME_MAX = 200;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isImageFileId = (id: string): boolean => ID.test(id);

export const questionImagesDir = (home: string, questionId: string): string =>
  join(home, "questions", questionId);

function extensionOf(path: string): ImageExtension | null {
  const ext = extname(path).slice(1).toLowerCase();
  return QUESTION_IMAGE_LIMITS.extensions.find((allowed) => allowed === ext) ?? null;
}

const isMissing = (e: unknown): boolean =>
  e instanceof Error && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR");

function orMissing<T>(read: () => T): T | null {
  try {
    return read();
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

const realOrNull = (fs: ImageFs, path: string): string | null => orMissing(() => fs.realpath(path));

const isInside = (path: string, root: string): boolean =>
  path.startsWith(root.endsWith(sep) ? root : root + sep);

type Checked = { ok: true; image: PreparedImage } | { ok: false; reason: string };

function checkImage(path: string, roots: readonly string[], fs: ImageFs, newId: () => string): Checked {
  if (!isAbsolute(path)) return { ok: false, reason: "chemin relatif" };
  const ext = extensionOf(path);
  if (ext === null) return { ok: false, reason: "type non pris en charge" };
  const real = realOrNull(fs, path);
  if (real === null) return { ok: false, reason: "fichier introuvable" };
  if (!roots.some((root) => isInside(real, root))) return { ok: false, reason: "hors des dossiers permis" };
  if (extensionOf(real) === null) return { ok: false, reason: "type non pris en charge" };
  const stat = fs.stat(real);
  if (!stat.isFile) return { ok: false, reason: "pas un fichier" };
  if (stat.size > QUESTION_IMAGE_LIMITS.bytes) return { ok: false, reason: "plus de 5 Mio" };
  const bytes = fs.readFile(real);
  if (bytes.length > QUESTION_IMAGE_LIMITS.bytes) return { ok: false, reason: "plus de 5 Mio" };
  const size = imageSize(bytes);
  const name = basename(path).slice(0, IMAGE_NAME_MAX);
  const image = {
    id: newId(),
    name,
    bytes: bytes.length,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
  return { ok: true, image: { image, ext, bytes } };
}

export function prepareQuestionImages(input: {
  paths: readonly string[];
  allowedRoots: readonly (string | null)[];
  fs: ImageFs;
  log(line: string): void;
  newId?: () => string;
}): PreparedImage[] {
  const newId = input.newId ?? (() => crypto.randomUUID());
  const roots = input.allowedRoots.flatMap((root) => {
    const real = root === null ? null : realOrNull(input.fs, root);
    return real === null ? [] : [real];
  });
  const kept: PreparedImage[] = [];
  for (const path of input.paths) {
    const name = basename(path);
    if (kept.length >= QUESTION_IMAGE_LIMITS.count) {
      input.log(`image omise ${name} : plus de ${QUESTION_IMAGE_LIMITS.count} images`);
      continue;
    }
    const checked = checkImage(path, roots, input.fs, newId);
    if (checked.ok) kept.push(checked.image);
    else input.log(`image omise ${name} : ${checked.reason}`);
  }
  return kept;
}

export function storeQuestionImages(input: {
  home: string;
  questionId: string;
  images: readonly PreparedImage[];
  fs: ImageFs;
}): void {
  if (!ID.test(input.questionId)) throw new Error(`invalid question id ${input.questionId}`);
  if (input.images.length === 0) return;
  const dir = questionImagesDir(input.home, input.questionId);
  input.fs.mkdir(dir);
  for (const { image, ext, bytes } of input.images)
    input.fs.writeFile(join(dir, `${image.id}.${ext}`), bytes);
}

export function readQuestionImage(input: {
  home: string;
  questionId: string;
  imageId: string;
  fs: ImageFs;
}): QuestionImageFile | null {
  if (!ID.test(input.questionId) || !ID.test(input.imageId)) return null;
  const dir = questionImagesDir(input.home, input.questionId);
  for (const ext of QUESTION_IMAGE_LIMITS.extensions) {
    const file = join(dir, `${input.imageId}.${ext}`);
    const stat = orMissing(() => input.fs.stat(file));
    if (stat === null) continue;
    return stat.isFile ? { bytes: input.fs.readFile(file), mime: MIME[ext] } : null;
  }
  return null;
}
