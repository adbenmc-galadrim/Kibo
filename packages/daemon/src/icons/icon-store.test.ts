import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createIconStore, ensureIconsTable } from "./icon-store";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const open = () => {
  const db = new Database(":memory:", { strict: true });
  ensureIconsTable(db);
  return createIconStore(db);
};

test("stores bytes by owner and versions them by sha256", () => {
  const icons = open();
  expect(icons.get("project:p1")).toBeNull();
  expect(icons.version("project:p1")).toBeNull();
  const version = icons.set("project:p1", "image/png", PNG);
  expect(version).toBe(new Bun.CryptoHasher("sha256").update(PNG).digest("hex"));
  expect(icons.version("project:p1")).toBe(version);
  expect(icons.get("project:p1")).toEqual({ mime: "image/png", bytes: PNG, sha256: version });
});

test("replacing and removing an icon", () => {
  const icons = open();
  const first = icons.set("workspace", "image/png", PNG);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  expect(icons.set("workspace", "image/jpeg", jpeg)).not.toBe(first);
  expect(icons.get("workspace")?.mime).toBe("image/jpeg");
  icons.remove("workspace");
  expect(icons.get("workspace")).toBeNull();
  icons.remove("workspace");
});
