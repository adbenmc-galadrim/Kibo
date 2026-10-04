import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSET_URL_TTL_MS } from "@kibo/schema";
import { ensureSettingsTable } from "../notes/settings";
import { folder, GLB, PNG } from "./files.test-helper";
import { createFilesService, type FilesService } from "./service";

const services: FilesService[] = [];
afterAll(async () => {
  for (const s of services) await s.close();
});

function setup(origin: string | null = "http://127.0.0.1:4318") {
  const { root } = folder();
  const home = join(root, "kibo-home");
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const files = createFilesService({
    db,
    home,
    project: (id) => ({ id, key: "KIB", folder: null }),
    sandboxOrigin: () => origin,
    now: () => 1000,
    homeDir: root,
  });
  services.push(files);
  return { root, home, files };
}

test("the folder defaults to KIBO_HOME/files/<KEY> and can be moved", async () => {
  const { root, home, files } = setup();
  expect(files.dirOf("p")).toBe(join(home, "files", "KIB"));
  expect(await files.info("p")).toEqual({
    dir: join(home, "files", "KIB"),
    displayDir: "~/kibo-home/files/KIB",
    used: 0,
  });
  const elsewhere = join(root, "assets");
  const moved = await files.setDir("p", elsewhere);
  expect(moved.dir).toBe(realpathSync(elsewhere));
  writeFileSync(join(elsewhere, "a.png"), PNG);
  expect((await files.info("p")).used).toBe(12);
  expect((await files.list("p")).map((a) => a.name)).toEqual(["a.png"]);
  await files.remove("p", "a.png");
  expect(await files.list("p")).toEqual([]);
  expect((await files.setDir("p", null)).dir).toBe(join(home, "files", "KIB"));
  await expect(files.setDir("p", "relative/path")).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("url mints a token served by the sandbox port, open resolves it", async () => {
  const { files } = setup();
  const dir = files.dirOf("p");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "robot.glb"), GLB);
  writeFileSync(join(dir, "fake.glb"), PNG);
  const { url, expiresAt } = await files.url("p", "i", "robot.glb");
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:4318\/f\/[0-9a-f]{64}\/robot\.glb$/);
  expect(expiresAt).toBe(1000 + ASSET_URL_TTL_MS);
  const token = url.split("/")[4] ?? "";
  expect(await files.open(token)).toEqual({
    path: join(realpathSync(dir), "robot.glb"),
    mime: "model/gltf-binary",
    size: 20,
  });
  expect(await files.open("0".repeat(64))).toBeNull();
  await expect(files.url("p", "i", "missing.glb")).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(files.url("p", "i", "fake.glb")).rejects.toMatchObject({ code: "NOT_FOUND" });
  writeFileSync(join(dir, "robot.glb"), PNG);
  expect(await files.open(token)).toBeNull();
});

test("url needs the sandbox listener", async () => {
  const { files } = setup(null);
  const dir = files.dirOf("p");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "robot.glb"), GLB);
  await expect(files.url("p", "i", "robot.glb")).rejects.toMatchObject({ code: "INTERNAL" });
});

test("uploads land in the project folder", async () => {
  const { files } = setup();
  const { uploadId } = await files.uploads.begin("p", "robot.glb", "model/gltf-binary", 20);
  await files.uploads.append(uploadId, 0, GLB);
  await files.uploads.finish(uploadId);
  expect((await files.list("p")).map((a) => a.name)).toEqual(["robot.glb"]);
});
