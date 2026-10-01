import { expect, test } from "bun:test";
import { DraftAttachmentName, MAX_ICON_BYTES } from "@kibo/schema";
import { addAttachment, attachmentBytes, attachmentName, imageFiles, readAttachment } from "./attachments";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0];
const pngFile = (name: string, type = "image/png") => new File([new Uint8Array(PNG)], name, { type });
const item = (name: string) => ({ name, mime: "image/png" as const, data: "AAAA" });

test("attachmentName keeps letters, digits, dots and dashes, bounds to 64 and matches the mime", () => {
  expect(attachmentName("Maquette Kanban (v2).PNG", "image/png")).toBe("Maquette-Kanban-v2.png");
  expect(attachmentName(`${"x".repeat(90)}.jpeg`, "image/jpeg").length).toBeLessThanOrEqual(64);
  expect(attachmentName("", "image/webp")).toBe("image.webp");
  expect(attachmentName("photo.jpeg", "image/jpeg")).toBe("photo.jpeg");
  expect(attachmentName("photo.gif", "image/png")).toBe("photo.png");
  expect(attachmentName("_.hidden", "image/png")).toBe("hidden.png");
});

test("a screenshot named by macOS is sent under a name the daemon accepts", () => {
  const name = attachmentName("Capture d'écran 2026-10-01 à 10.12.33.png", "image/png");
  expect(name).toBe("Capture-d-ecran-2026-10-01-a-10.12.33.png");
  expect(DraftAttachmentName.safeParse(name).success).toBe(true);
  for (const raw of ["été 😀.webp", "...", "日本語.png", `${"é".repeat(80)}.png`]) {
    expect(DraftAttachmentName.safeParse(attachmentName(raw, "image/webp")).success).toBe(true);
  }
});

test("addAttachment refuses the fifth image", () => {
  const four = Array.from({ length: 4 }, (_, i) => item(`${i}.png`));
  expect(addAttachment(four, item("5.png"))).toEqual({ ok: false, refusal: "count" });
  expect(addAttachment([], item("a.png"))).toMatchObject({ ok: true });
});

test("addAttachment renames a duplicate so each image keeps its own label", () => {
  const first = addAttachment([], item("a.png"));
  if (!first.ok) throw new Error("refused");
  const second = addAttachment(first.list, item("a.png"));
  expect(second.ok && second.list.map((a) => a.name)).toEqual(["a.png", "a-2.png"]);
});

test("addAttachment refuses an image over 256 kB", () => {
  const data = "A".repeat(Math.ceil(((MAX_ICON_BYTES + 3) * 4) / 3));
  expect(addAttachment([], { name: "big.png", mime: "image/png", data })).toEqual({
    ok: false,
    refusal: "too-large",
  });
  expect(attachmentBytes({ data: "AAAA" })).toBe(3);
  expect(attachmentBytes({ data: "AA==" })).toBe(1);
});

test("readAttachment trusts the bytes, not the type the browser announces", async () => {
  expect(await readAttachment(pngFile("capture", ""))).toEqual({
    ok: true,
    item: { name: "capture.png", mime: "image/png", data: "iVBORw0KGgoAAAAN" },
  });
  expect(await readAttachment(new File([new Uint8Array(GIF)], "a.png", { type: "image/png" }))).toEqual({
    ok: false,
    refusal: "format",
  });
  const big = new File([new Uint8Array(MAX_ICON_BYTES + 1)], "big.png", { type: "image/png" });
  expect(await readAttachment(big)).toEqual({ ok: false, refusal: "too-large" });
});

test("imageFiles keeps the files of a transfer and ignores text", () => {
  const files = [pngFile("a.png")];
  expect(imageFiles({ files })).toEqual(files);
  expect(imageFiles(null)).toEqual([]);
});
