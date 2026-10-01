import { expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DraftAttachmentInput, KiboError, MAX_ICON_BYTES } from "@kibo/schema";
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
  const list = writeAttachments(dir, [png("maquette.png"), png("b.webp")], []);
  expect(list).toEqual([
    { name: "maquette.png", mime: "image/png", bytes: 12 },
    { name: "b.webp", mime: "image/png", bytes: 12 },
  ]);
  expect(readdirSync(dir).sort()).toEqual(["1-maquette.png", "2-b.webp"]);
  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, "1-maquette.png")).mode & 0o777).toBe(0o600);
  expect(readFileSync(join(dir, "1-maquette.png"))).toEqual(Buffer.from(pngBase64(), "base64"));
  expect(attachmentPaths(dir, list)).toEqual([join(dir, "1-maquette.png"), join(dir, "2-b.webp")]);
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
