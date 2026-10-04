import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addInstance, boot, createProject, type Harness, SANDBOX_ORIGIN } from "./service.test-helper";

const GLB = Uint8Array.from([...Buffer.from("glTF"), 2, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

let home: string;
let h: Harness;
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-files-rpc-"));
  h = await boot(home);
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

test("a file uploaded over RPC is listed and served to a component by token", async () => {
  const { projectId, pageId } = await createProject(h);
  const dir = join(home, "files", "KIB");
  expect(await h.rpc({ method: "getFilesDir", projectId })).toMatchObject({ dir, used: 0 });
  const { uploadId } = await h.rpc({
    method: "beginAssetUpload",
    projectId,
    name: "robot.glb",
    mime: "model/gltf-binary",
    size: GLB.byteLength,
  });
  expect(await h.rpc({ method: "appendAssetUpload", uploadId, index: 0, bytes: base64(GLB) })).toEqual({
    received: 20,
  });
  expect(await h.rpc({ method: "finishAssetUpload", uploadId })).toMatchObject({
    name: "robot.glb",
    size: 20,
  });
  expect((await h.rpc({ method: "listAssets", projectId })).map((a) => a.name)).toEqual(["robot.glb"]);
  const inst = await addInstance(h, projectId, pageId, "kanban@1.0.0");
  const served = (await h.rpc({
    method: "componentCall",
    projectId,
    instanceId: inst.id,
    call: { kind: "assets.url", name: "robot.glb" },
  })) as { url: string };
  expect(served.url.startsWith(`${SANDBOX_ORIGIN}/f/`)).toBe(true);
  const token = served.url.split("/")[4] ?? "";
  expect(await h.components.files.open(token)).toMatchObject({ mime: "model/gltf-binary", size: 20 });
  expect(await h.rpc({ method: "removeAsset", projectId, name: "robot.glb" })).toBeNull();
  expect(await h.components.files.open(token)).toBeNull();
  await expect(h.rpc({ method: "listAssets", projectId: "ghost" })).rejects.toThrow("NOT_FOUND");
});

test("cancel and shutdown drop pending uploads", async () => {
  const { projectId } = await createProject(h);
  const begin = () =>
    h.rpc({ method: "beginAssetUpload", projectId, name: "a.glb", mime: "model/gltf-binary", size: 20 });
  const first = await begin();
  expect(await h.rpc({ method: "cancelAssetUpload", uploadId: first.uploadId })).toBeNull();
  await begin();
  const uploads = join(home, "files", "KIB", ".uploads");
  expect(readdirSync(uploads)).toHaveLength(1);
  await h.stop();
  expect(readdirSync(uploads)).toEqual([]);
  h = await boot(home);
  expect(existsSync(join(home, "files", "KIB", "a.glb"))).toBe(false);
});
