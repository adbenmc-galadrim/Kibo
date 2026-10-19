import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { QUESTION_IMAGE_LIMITS } from "@kibo/schema";
import {
  nodeImageFs,
  prepareQuestionImages,
  questionImagesDir,
  readQuestionImage,
  removeQuestionImages,
  storeQuestionImages,
} from "./question-images";
import { imagesTmp, pngBytes, removalFs, writeImage } from "./question-images.test-helper";

const QUESTION_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function setup() {
  const root = imagesTmp();
  const roots = { cwd: join(root, "worktree"), delivery: join(root, "silo"), notes: join(root, "notes") };
  const home = join(root, "kibo");
  const lines: string[] = [];
  const prepare = (paths: readonly string[]) =>
    prepareQuestionImages({
      paths,
      allowedRoots: [roots.cwd, roots.delivery, null, roots.notes],
      fs: nodeImageFs,
      log: (line) => lines.push(line),
    });
  return { root, roots, home, lines, prepare };
}

test("an image under one of the three allowed folders is kept with its metadata only", () => {
  const { root, roots, lines, prepare } = setup();
  const paths = [
    writeImage(join(roots.cwd, "shots/1-no-access.png")),
    writeImage(join(roots.delivery, "2-list.PNG"), pngBytes(1440, 900)),
    writeImage(join(roots.notes, "3-detail.webp"), Uint8Array.from([1, 2, 3])),
  ];
  const prepared = prepare(paths);
  expect(prepared.map((p) => p.image)).toEqual([
    { id: expect.any(String), name: "1-no-access.png", bytes: 29, width: 800, height: 600 },
    { id: expect.any(String), name: "2-list.PNG", bytes: 29, width: 1440, height: 900 },
    { id: expect.any(String), name: "3-detail.webp", bytes: 3, width: null, height: null },
  ]);
  expect(new Set(prepared.map((p) => p.image.id)).size).toBe(3);
  expect(JSON.stringify(prepared.map((p) => p.image))).not.toContain(root);
  expect(lines).toEqual([]);
});

test("a refused image is omitted and logged by name, never by path", () => {
  const { root, roots, lines, prepare } = setup();
  const outside = writeImage(join(root, "elsewhere/secret.png"));
  const linked = join(roots.cwd, "link.png");
  writeImage(join(roots.cwd, "keep.png"));
  symlinkSync(outside, linked);
  const prepared = prepare([
    outside,
    writeImage(join(roots.cwd, "logo.svg"), Uint8Array.from([60, 115, 118, 103, 47, 62])),
    writeImage(join(roots.cwd, "huge.png"), pngBytes(10, 10, QUESTION_IMAGE_LIMITS.bytes)),
    linked,
    join(roots.cwd, "../elsewhere/secret.png"),
    "shots/relative.png",
    join(roots.cwd, "missing.png"),
    join(roots.cwd, "keep.png"),
  ]);
  expect(prepared.map((p) => p.image.name)).toEqual(["keep.png"]);
  expect(lines).toHaveLength(7);
  expect(lines.join("\n")).not.toContain(root);
  expect(lines[0]).toContain("secret.png");
  expect(lines[1]).toContain("logo.svg");
  expect(lines[2]).toContain("huge.png");
});

test("a symbolic link inside an allowed folder to an image inside it is kept", () => {
  const { roots, prepare } = setup();
  const target = writeImage(join(roots.delivery, "real.png"));
  mkdirSync(roots.cwd, { recursive: true });
  symlinkSync(target, join(roots.cwd, "alias.png"));
  expect(prepare([join(roots.cwd, "alias.png")]).map((p) => p.image.name)).toEqual(["alias.png"]);
});

test("seven images give six, the seventh is logged", () => {
  const { roots, lines, prepare } = setup();
  const paths = Array.from({ length: 7 }, (_, i) => writeImage(join(roots.cwd, `shot-${i}.png`)));
  expect(prepare(paths).map((p) => p.image.name)).toEqual(paths.slice(0, 6).map((_, i) => `shot-${i}.png`));
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("shot-6.png");
});

test("stored images are private copies that outlive the original and are read back by id", () => {
  const { home, roots, prepare } = setup();
  const prepared = prepare([writeImage(join(roots.cwd, "1.png")), writeImage(join(roots.cwd, "2.jpg"))]);
  storeQuestionImages({ home, questionId: QUESTION_ID, images: prepared, fs: nodeImageFs });
  const [png, jpg] = prepared;
  if (!png || !jpg) throw new Error("two images expected");
  const file = join(questionImagesDir(home, QUESTION_ID), `${png.image.id}.png`);
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(statSync(questionImagesDir(home, QUESTION_ID)).mode & 0o777).toBe(0o700);
  expect(readFileSync(file)).toEqual(Buffer.from(pngBytes(800, 600)));
  const read = (imageId: string, questionId = QUESTION_ID) =>
    readQuestionImage({ home, questionId, imageId, fs: nodeImageFs });
  expect(read(png.image.id)).toEqual({ bytes: expect.any(Uint8Array), mime: "image/png" });
  expect(read(jpg.image.id)?.mime).toBe("image/jpeg");
  expect(read("00000000-0000-4000-8000-000000000000")).toBeNull();
  expect(read(png.image.id, "6f1c2a3b-4d5e-4f60-8a7b-000000000000")).toBeNull();
  expect(read("../../kibo")).toBeNull();
  expect(read(png.image.id, "..")).toBeNull();
});

test("removing the images of a question removes its folder under the home", () => {
  const fs = removalFs();
  removeQuestionImages({ home: "/home/kibo", questionId: QUESTION_ID, fs });
  expect(fs.removed).toEqual([join("/home/kibo", "questions", QUESTION_ID)]);
});

test("a question id that cannot name a folder removes nothing", () => {
  const fs = removalFs();
  removeQuestionImages({ home: "/home/kibo", questionId: "../notes", fs });
  expect(fs.removed).toEqual([]);
});

test("the node file system removes a folder and accepts one that is already gone", () => {
  const { home } = setup();
  const dir = questionImagesDir(home, QUESTION_ID);
  writeImage(join(dir, "1.png"));
  nodeImageFs.remove(dir);
  expect(existsSync(dir)).toBe(false);
  expect(() => nodeImageFs.remove(dir)).not.toThrow();
});
