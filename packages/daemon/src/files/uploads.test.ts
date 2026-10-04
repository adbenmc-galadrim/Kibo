import { expect, test } from "bun:test";
import { existsSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_PROJECT_ASSET_BYTES, UPLOAD_CHUNK_BYTES, UPLOAD_IDLE_MS } from "@kibo/schema";
import { folder, GLB, PNG } from "./files.test-helper";
import { createUploads } from "./uploads";

function kit(now = { t: 1000 }) {
  const { root, dir } = folder();
  const uploads = createUploads({ dir: () => dir, now: () => now.t });
  return { root, dir, uploads, now };
}
const chunk = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

test("a two-chunk glb lands atomically with the right signature", async () => {
  const { dir, uploads } = kit();
  const body = new Uint8Array(UPLOAD_CHUNK_BYTES + 100);
  body.set(GLB, 0);
  const { uploadId } = await uploads.begin("p", "robot.glb", "model/gltf-binary", body.byteLength);
  expect(statSync(join(dir, ".uploads")).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, ".uploads", uploadId)).mode & 0o777).toBe(0o600);
  expect(await uploads.append(uploadId, 0, body.subarray(0, UPLOAD_CHUNK_BYTES))).toEqual({
    received: UPLOAD_CHUNK_BYTES,
  });
  await expect(uploads.append(uploadId, 0, chunk(10))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(uploads.append(uploadId, 1, chunk(200))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await uploads.append(uploadId, 1, body.subarray(UPLOAD_CHUNK_BYTES));
  const asset = await uploads.finish(uploadId);
  expect(asset).toMatchObject({ name: "robot.glb", kind: "model", size: body.byteLength });
  expect(existsSync(join(dir, ".uploads", uploadId))).toBe(false);
  expect(readdirSync(join(dir, ".uploads"))).toEqual([]);
  await expect(uploads.finish(uploadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("a short middle chunk is refused", async () => {
  const { uploads } = kit();
  const { uploadId } = await uploads.begin("p", "robot.glb", "model/gltf-binary", UPLOAD_CHUNK_BYTES + 10);
  await expect(uploads.append(uploadId, 0, chunk(10))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(uploads.append(uploadId, 0, chunk(UPLOAD_CHUNK_BYTES + 1))).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(uploads.append(crypto.randomUUID(), 0, chunk(10))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("finish refuses a short body, a lying signature and a taken name, and cleans up", async () => {
  const { dir, uploads } = kit();
  const short = await uploads.begin("p", "a.glb", "model/gltf-binary", UPLOAD_CHUNK_BYTES + 10);
  const head = new Uint8Array(UPLOAD_CHUNK_BYTES);
  head.set(GLB, 0);
  await uploads.append(short.uploadId, 0, head);
  await expect(uploads.finish(short.uploadId)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const lying = await uploads.begin("p", "b.glb", "model/gltf-binary", PNG.byteLength);
  await uploads.append(lying.uploadId, 0, PNG);
  await expect(uploads.finish(lying.uploadId)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(uploads.begin("p", "e.png", "model/gltf-binary", 20)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  writeFileSync(join(dir, "c.glb"), GLB);
  await expect(uploads.begin("p", "c.glb", "model/gltf-binary", 20)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  const race = await uploads.begin("p", "d.glb", "model/gltf-binary", 20);
  await uploads.append(race.uploadId, 0, GLB);
  writeFileSync(join(dir, "d.glb"), GLB);
  await expect(uploads.finish(race.uploadId)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(readdirSync(join(dir, ".uploads"))).toEqual([]);
  expect(existsSync(join(dir, "a.glb"))).toBe(false);
  expect(existsSync(join(dir, "b.glb"))).toBe(false);
});

test("cancel and close remove the temporary files", async () => {
  const { dir, uploads } = kit();
  const a = await uploads.begin("p", "a.glb", "model/gltf-binary", 20);
  await uploads.begin("p", "b.glb", "model/gltf-binary", 20);
  await uploads.cancel(a.uploadId);
  expect(readdirSync(join(dir, ".uploads"))).toHaveLength(1);
  await uploads.close();
  expect(readdirSync(join(dir, ".uploads"))).toEqual([]);
});

test("a linked uploads folder is refused", async () => {
  const { root, dir, uploads } = kit();
  symlinkSync(root, join(dir, ".uploads"));
  await expect(uploads.begin("p", "a.glb", "model/gltf-binary", 20)).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  expect(readdirSync(root).sort()).toEqual(["files", "secret.md"]);
});

test("limits: size, project quota, concurrent uploads, idle expiry", async () => {
  const { dir, uploads, now } = kit();
  await expect(
    uploads.begin("p", "big.glb", "model/gltf-binary", MAX_PROJECT_ASSET_BYTES + 1),
  ).rejects.toMatchObject({ code: "TOO_LARGE" });
  const quota = createUploads({ dir: () => dir, now: () => now.t, maxProjectBytes: 50 });
  writeFileSync(join(dir, "x.glb"), GLB);
  await quota.begin("p", "w.glb", "model/gltf-binary", 20);
  await expect(quota.begin("p", "y.glb", "model/gltf-binary", 20)).rejects.toMatchObject({
    code: "QUOTA_EXCEEDED",
  });
  await quota.close();
  for (let i = 0; i < 4; i++) await uploads.begin("p", `u${i}.glb`, "model/gltf-binary", 20);
  await expect(uploads.begin("p", "u4.glb", "model/gltf-binary", 20)).rejects.toMatchObject({
    code: "RATE_LIMITED",
  });
  await uploads.begin("q", "u4.glb", "model/gltf-binary", 20);
  now.t += UPLOAD_IDLE_MS + 1;
  await uploads.begin("p", "u5.glb", "model/gltf-binary", 20);
  expect(readdirSync(join(dir, ".uploads"))).toHaveLength(1);
});

test("concurrent begins cannot exceed the per-project limit", async () => {
  const { uploads } = kit();
  const results = await Promise.allSettled(
    [0, 1, 2, 3, 4, 5].map((i) => uploads.begin("p", `c${i}.glb`, "model/gltf-binary", 20)),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
});

test("a single chunk larger than the chunk size is refused even when it is the last", async () => {
  const { uploads } = kit();
  const size = UPLOAD_CHUNK_BYTES + 10;
  const { uploadId } = await uploads.begin("p", "robot.glb", "model/gltf-binary", size);
  await expect(uploads.append(uploadId, 0, chunk(size))).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("orphans left by a crash are purged when a new upload starts", async () => {
  const { dir, uploads, now } = kit({ t: Date.now() });
  const first = await uploads.begin("p", "a.glb", "model/gltf-binary", 20);
  writeFileSync(join(dir, ".uploads", "stale"), "x");
  writeFileSync(join(dir, ".uploads", "fresh"), "x");
  const old = (now.t - UPLOAD_IDLE_MS - 1000) / 1000;
  utimesSync(join(dir, ".uploads", "stale"), old, old);
  utimesSync(join(dir, ".uploads", first.uploadId), old, old);
  await uploads.begin("p", "b.glb", "model/gltf-binary", 20);
  expect(readdirSync(join(dir, ".uploads"))).toHaveLength(3);
  expect(existsSync(join(dir, ".uploads", "stale"))).toBe(false);
  expect(existsSync(join(dir, ".uploads", first.uploadId))).toBe(true);
});

test("cancel during an append drops the upload once the append ends", async () => {
  const { dir, uploads } = kit();
  const { uploadId } = await uploads.begin("p", "a.glb", "model/gltf-binary", 20);
  const pending = uploads.append(uploadId, 0, GLB);
  await uploads.cancel(uploadId);
  await expect(pending).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(readdirSync(join(dir, ".uploads"))).toEqual([]);
  await expect(uploads.finish(uploadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("concurrent uploads purge the same orphans without failing", async () => {
  const { dir, uploads, now } = kit({ t: Date.now() });
  await uploads.cancel((await uploads.begin("p", "a.glb", "model/gltf-binary", 20)).uploadId);
  const old = (now.t - UPLOAD_IDLE_MS - 1000) / 1000;
  for (let i = 0; i < 40; i++) {
    const orphan = join(dir, ".uploads", `orphan-${i}`);
    writeFileSync(orphan, "x");
    utimesSync(orphan, old, old);
  }
  const names = ["b.glb", "c.glb", "d.glb", "e.glb"];
  const begun = await Promise.all(names.map((n) => uploads.begin("p", n, "model/gltf-binary", 20)));
  expect(begun).toHaveLength(4);
  expect(readdirSync(join(dir, ".uploads")).sort()).toEqual(begun.map((b) => b.uploadId).sort());
});
