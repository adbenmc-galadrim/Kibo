import { expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folder, GLB, PNG } from "./files.test-helper";
import { folderUsage, listAssetFiles, openAssetFile, removeAssetFile } from "./files-fs";

test("lists only well-named files whose signature matches their extension", async () => {
  const { root, dir } = folder();
  writeFileSync(join(dir, "robot.glb"), GLB);
  writeFileSync(join(dir, "fake.glb"), PNG);
  writeFileSync(join(dir, "Photo.PNG"), PNG);
  writeFileSync(join(dir, "notes.txt"), "x");
  mkdirSync(join(dir, ".uploads"));
  mkdirSync(join(dir, "folder.png"));
  symlinkSync(join(root, "secret.md"), join(dir, "link.png"));
  const listed = await listAssetFiles(dir);
  expect(listed.map((a) => [a.name, a.kind, a.size])).toEqual([["robot.glb", "model", 20]]);
  expect(await listAssetFiles(join(dir, "missing"))).toEqual([]);
});

test("open refuses a mismatched signature, a symlink and a missing file", async () => {
  const { root, dir } = folder();
  writeFileSync(join(dir, "robot.glb"), GLB);
  writeFileSync(join(dir, "fake.glb"), PNG);
  symlinkSync(join(root, "secret.md"), join(dir, "link.glb"));
  expect((await openAssetFile(dir, "robot.glb", "model/gltf-binary")).size).toBe(20);
  await expect(openAssetFile(dir, "robot.glb", "image/png")).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(openAssetFile(dir, "fake.glb", "model/gltf-binary")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(openAssetFile(dir, "link.glb", "model/gltf-binary")).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  await expect(openAssetFile(dir, "nope.glb", "model/gltf-binary")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(openAssetFile(dir, "../secret.glb", "model/gltf-binary")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("usage sums listed files and remove deletes one", async () => {
  const { dir } = folder();
  writeFileSync(join(dir, "a.png"), PNG);
  writeFileSync(join(dir, "b.png"), PNG);
  expect(await folderUsage(dir)).toBe(24);
  await removeAssetFile(dir, "a.png");
  expect((await listAssetFiles(dir)).map((a) => a.name)).toEqual(["b.png"]);
  await expect(removeAssetFile(dir, "a.png")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
