import { ASSET_URL_TTL_MS, type AssetUrl, KiboError, type ProjectAsset } from "@kibo/schema";
import { sampleGlb } from "./fixtures-glb";
import { bytesToBase64 } from "./lib/base64";

export const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function silentWav(): Uint8Array {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (const [i, c] of [...value].entries()) bytes[offset + i] = c.charCodeAt(0);
  };
  text(0, "RIFF");
  view.setUint32(4, 36, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  return bytes;
}

const payloadOf = (asset: ProjectAsset): string => {
  if (asset.kind === "model") return bytesToBase64(sampleGlb());
  if (asset.kind === "image") return PIXEL_PNG;
  return bytesToBase64(silentWav());
};

export function mockAssetUrl(assets: readonly ProjectAsset[], name: string, now = Date.now()): AssetUrl {
  const asset = assets.find((a) => a.name === name);
  if (!asset) throw new KiboError("NOT_FOUND", `no project file named ${name}`);
  return { url: `data:${asset.mime};base64,${payloadOf(asset)}`, expiresAt: now + ASSET_URL_TTL_MS };
}
