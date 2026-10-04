import { expect, test } from "bun:test";
import { assetNameFor, imageFromClipboard } from "./paste-image";

test("the asset name slugs the note and stamps the time", () => {
  expect(assetNameFor("journal.md", "image/png", new Date(Date.UTC(2026, 9, 4, 10, 15, 0)))).toBe(
    "journal-20261004-101500.png",
  );
  expect(assetNameFor("dossier/Idées 2026.md", "image/jpeg", new Date(Date.UTC(2026, 0, 1, 0, 0, 1)))).toBe(
    "idees-2026-20260101-000001.jpg",
  );
  expect(assetNameFor("é.md", "image/webp", new Date(Date.UTC(2026, 0, 1)))).toBe(
    "note-20260101-000000.webp",
  );
});

test("only the first image item of the clipboard is taken", () => {
  const png = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
  const svg = new File([new Uint8Array([1])], "a.svg", { type: "image/svg+xml" });
  const txt = new File([new Uint8Array([1])], "a.txt", { type: "text/plain" });
  const data = (files: File[]) => ({ files }) as unknown as DataTransfer;
  expect(imageFromClipboard(data([txt, svg, png]))).toBe(png);
  expect(imageFromClipboard(data([txt, svg]))).toBeNull();
  expect(imageFromClipboard(null)).toBeNull();
});
