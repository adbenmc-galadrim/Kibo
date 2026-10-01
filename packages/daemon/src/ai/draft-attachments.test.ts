import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  type DraftAttachment,
  type DraftAttachmentInput,
  KiboError,
  MAX_DRAFT_ATTACHMENTS_TOTAL,
  MAX_ICON_BYTES,
} from "@kibo/schema";
import { attachmentPaths, checkAttachments, writeAttachments } from "./draft-attachments";
import { cleanHomes, home } from "./testing/draft-fixture";

cleanHomes();

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngBase64 = (extra = 4) => Buffer.from([...PNG, ...Array(extra).fill(7)]).toString("base64");
const png = (name: string): DraftAttachmentInput => ({ name, mime: "image/png", data: pngBase64() });
const codeOf = (action: () => unknown): string | null => {
  try {
    action();
    return null;
  } catch (e) {
    return e instanceof KiboError ? e.code : "not a KiboError";
  }
};

test("writeAttachments decodes, numbers, protects and lists; a wrong signature writes nothing", () => {
  const dir = join(home(), "d.attachments");
  const list = writeAttachments(dir, [png("maquette.png"), png("b.png")], []);
  expect(list).toEqual([
    { name: "maquette.png", mime: "image/png", bytes: 12 },
    { name: "b.png", mime: "image/png", bytes: 12 },
  ]);
  expect(readdirSync(dir).sort()).toEqual(["1-maquette.png", "2-b.png"]);
  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, "1-maquette.png")).mode & 0o777).toBe(0o600);
  expect(readFileSync(join(dir, "1-maquette.png"))).toEqual(Buffer.from(pngBase64(), "base64"));
  expect(attachmentPaths(dir, list)).toEqual([join(dir, "1-maquette.png"), join(dir, "2-b.png")]);
  const gif = { name: "evil.png", mime: "image/png", data: btoa("GIF89a......") } as const;
  expect(() => writeAttachments(dir, [png("ok.png"), gif], list)).toThrow(KiboError);
  expect(codeOf(() => writeAttachments(dir, [gif], list))).toBe("INVALID_INPUT");
  expect(readdirSync(dir).length).toBe(2);
  expect(writeAttachments(dir, [png("maquette.png")], list).map((a) => a.name)).toEqual(["maquette.png"]);
  expect(readdirSync(dir)).toContain("3-maquette.png");
});

test("checkAttachments refuses a fifth image, an oversized one and a forged name before any write", () => {
  const big = Buffer.from([...PNG, ...new Uint8Array(MAX_ICON_BYTES)]).toString("base64");
  expect(codeOf(() => checkAttachments(Array(5).fill(png("a.png"))))).toBe("INVALID_INPUT");
  expect(codeOf(() => checkAttachments([{ ...png("a.png"), data: big }]))).toBe("TOO_LARGE");
  expect(codeOf(() => checkAttachments([png("../a.png")]))).toBe("INVALID_INPUT");
  expect(codeOf(() => checkAttachments([png("a/b.png")]))).toBe("INVALID_INPUT");
  expect(codeOf(() => checkAttachments([{ ...png("a.png"), mime: "image/jpeg" }]))).toBe("INVALID_INPUT");
  expect(checkAttachments([png("a.png")])).toBeUndefined();
});

test("writeAttachments never follows a symbolic link, for the folder or a file", () => {
  const root = home();
  const outside = join(root, "outside");
  mkdirSync(outside);
  const linked = join(root, "linked.attachments");
  symlinkSync(outside, linked);
  expect(codeOf(() => writeAttachments(linked, [png("a.png")], []))).toBe("STORE_CORRUPT");
  expect(readdirSync(outside)).toEqual([]);
  const dir = join(root, "d.attachments");
  mkdirSync(dir, { mode: 0o700 });
  symlinkSync(join(outside, "stolen.png"), join(dir, "1-a.png"));
  expect(codeOf(() => writeAttachments(dir, [png("a.png")], []))).toBe("STORE_CORRUPT");
  expect(readdirSync(outside)).toEqual([]);
});

test("a write that fails half-way removes the files of the call", () => {
  const dir = join(home(), "d.attachments");
  const first = writeAttachments(dir, [png("a.png")], []);
  writeFileSync(join(dir, "3-c.png"), "taken");
  expect(codeOf(() => writeAttachments(dir, [png("b.png"), png("c.png")], first))).toBe("STORE_CORRUPT");
  expect(readdirSync(dir).sort()).toEqual(["1-a.png", "3-c.png"]);
});

test("writeAttachments with nothing to add creates nothing", () => {
  const dir = join(home(), "d.attachments");
  expect(writeAttachments(dir, [], [])).toEqual([]);
  expect(() => statSync(dir)).toThrow();
});

test("the images of a draft are capped in total, before any write", () => {
  const dir = join(home(), "d.attachments");
  const one: DraftAttachment = { name: "a.png", mime: "image/png", bytes: 12 };
  const full = Array(MAX_DRAFT_ATTACHMENTS_TOTAL - 1).fill(one);
  expect(codeOf(() => writeAttachments(dir, [png("x.png"), png("y.png")], full))).toBe("INVALID_INPUT");
  expect(existsSync(dir)).toBe(false);
  expect(writeAttachments(dir, [png("x.png")], full)).toHaveLength(1);
});

test("the extension of a name follows the format found in the bytes", () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 1, 2]).toString("base64");
  const jpeg = (name: string): DraftAttachmentInput => ({ name, mime: "image/jpeg", data: JPEG });
  expect(checkAttachments([jpeg("a.jpg"), jpeg("b.JPEG"), png("c.PNG")])).toBeUndefined();
  for (const forged of [png("a.webp"), png("a.jpg"), png("a"), png("a.png.exe"), jpeg("a.png")])
    expect(codeOf(() => checkAttachments([forged]))).toBe("INVALID_INPUT");
  const dir = join(home(), "d.attachments");
  expect(codeOf(() => writeAttachments(dir, [png("a.png"), png("b.webp")], []))).toBe("INVALID_INPUT");
  expect(existsSync(dir)).toBe(false);
});

test("a refused image speaks of an image, not of an icon", () => {
  const big = Buffer.from([...PNG, ...new Uint8Array(MAX_ICON_BYTES)]).toString("base64");
  for (const input of [
    { ...png("a.png"), data: big },
    { ...png("a.png"), mime: "image/webp" as const },
  ]) {
    expect(() => checkAttachments([input])).toThrow("image");
    expect(() => checkAttachments([input])).not.toThrow("icon");
  }
});

test("a failed write leaves no file of the call and keeps what was already there", () => {
  const root = home();
  const taken = join(root, "e.attachments");
  mkdirSync(join(taken, "2-b.png"), { recursive: true });
  expect(codeOf(() => writeAttachments(taken, [png("a.png"), png("b.png")], []))).toBe("STORE_CORRUPT");
  expect(readdirSync(taken)).toEqual(["2-b.png"]);
});
