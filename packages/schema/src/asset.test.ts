import { expect, test } from "bun:test";
import {
  assetKindOf,
  MAX_PROJECT_ASSET_BYTES,
  MAX_UPLOAD_CHUNK_BASE64,
  ProjectAssetName,
  sniffAsset,
  UPLOAD_CHUNK_BYTES,
} from "./asset";
import { extensionMatches, mimeOfName } from "./asset-extension";

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? ascii(p) : p)));

test("names are lowercase slugs with a known extension", () => {
  for (const ok of ["robot.glb", "a.png", "scene-v2.jpeg", "beep.mp3", "loop.ogg", "hit.wav"])
    expect(ProjectAssetName.safeParse(ok).success).toBe(true);
  for (const bad of [
    "Robot.glb",
    "scene.gltf",
    "../x.glb",
    "a/b.png",
    ".hidden.png",
    "x.exe",
    `${"a".repeat(130)}.png`,
  ])
    expect(ProjectAssetName.safeParse(bad).success).toBe(false);
});

test("signatures identify glb, images and audio", () => {
  expect(sniffAsset(bytes("glTF", [2, 0, 0, 0], [0, 0, 0, 0]))).toBe("model/gltf-binary");
  expect(sniffAsset(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(sniffAsset(bytes("ID3", [4, 0, 0]))).toBe("audio/mpeg");
  expect(sniffAsset(bytes([0xff, 0xfb, 0x90, 0x00]))).toBe("audio/mpeg");
  expect(sniffAsset(bytes([0xff, 0x0f]))).toBeNull();
  expect(sniffAsset(bytes("OggS", [0, 2]))).toBe("audio/ogg");
  expect(sniffAsset(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toBe("audio/wav");
  expect(sniffAsset(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
  expect(sniffAsset(bytes('{ "asset": {} }'))).toBeNull();
  expect(sniffAsset(new Uint8Array(0))).toBeNull();
});

test("kinds and extensions follow the mime", () => {
  expect(assetKindOf("model/gltf-binary")).toBe("model");
  expect(assetKindOf("image/webp")).toBe("image");
  expect(assetKindOf("audio/wav")).toBe("audio");
  expect(extensionMatches("robot.glb", "model/gltf-binary")).toBe(true);
  expect(extensionMatches("photo.jpg", "image/jpeg")).toBe(true);
  expect(extensionMatches("photo.jpeg", "image/jpeg")).toBe(true);
  expect(extensionMatches("robot.glb", "image/png")).toBe(false);
  expect(mimeOfName("photo.jpeg")).toBe("image/jpeg");
  expect(mimeOfName("scene.gltf")).toBeNull();
});

test("limits stay under the daemon request cap", () => {
  expect(MAX_PROJECT_ASSET_BYTES).toBe(64 * 1024 * 1024);
  expect(UPLOAD_CHUNK_BYTES).toBe(1_048_576);
  expect(MAX_UPLOAD_CHUNK_BASE64).toBeGreaterThanOrEqual(Math.ceil(UPLOAD_CHUNK_BYTES / 3) * 4);
  expect(MAX_UPLOAD_CHUNK_BASE64).toBeLessThan(3 * 1_048_576);
});
