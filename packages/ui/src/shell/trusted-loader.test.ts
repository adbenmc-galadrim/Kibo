import { expect, test } from "bun:test";
import { loadTrusted } from "./trusted-loader";

const H = "f".repeat(64);
const manifest = { id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [] };

test("the module is imported once, its CSS linked once, and its shape checked", async () => {
  const urls: string[] = [];
  const importer = async (url: string) => {
    urls.push(url);
    return { manifest, Component: () => null };
  };
  const a = await loadTrusted("mine", "1.0.0", H, importer);
  const b = await loadTrusted("mine", "1.0.0", H, importer);
  expect(a).toBe(b);
  expect(urls).toEqual([`/components/mine/1.0.0/${H}/ui.trusted.js`]);
  expect(document.querySelectorAll(`link[href="/components/mine/1.0.0/${H}/ui.css"]`)).toHaveLength(1);
  expect(a.manifest.title).toBe("Mine");
});

test("a module without a valid manifest or Component is refused", async () => {
  await expect(
    loadTrusted("bad", "1.0.0", H, async () => ({ manifest: {}, Component: () => null })),
  ).rejects.toThrow("VALIDATION_FAILED");
  await expect(loadTrusted("bad2", "1.0.0", H, async () => ({ manifest }))).rejects.toThrow(
    "VALIDATION_FAILED",
  );
  await expect(loadTrusted("bad3", "1.0.0", H, async () => null)).rejects.toThrow("VALIDATION_FAILED");
  await expect(
    loadTrusted("other", "1.0.0", H, async () => ({ manifest, Component: () => null })),
  ).rejects.toThrow("VALIDATION_FAILED");
  await expect(
    loadTrusted("mine", "2.0.0", H, async () => ({ manifest, Component: () => null })),
  ).rejects.toThrow("VALIDATION_FAILED");
});

test("a failed import is not cached", async () => {
  let fail = true;
  const importer = async () => {
    if (fail) throw new Error("network");
    return { manifest: { ...manifest, id: "flaky" }, Component: () => null };
  };
  await expect(loadTrusted("flaky", "1.0.0", H, importer)).rejects.toThrow("network");
  fail = false;
  expect((await loadTrusted("flaky", "1.0.0", H, importer)).manifest.id).toBe("flaky");
});
