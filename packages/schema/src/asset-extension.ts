import { PROJECT_ASSET_MIMES, type ProjectAssetMime } from "./asset";

const EXTENSIONS: Readonly<Record<ProjectAssetMime, readonly string[]>> = {
  "model/gltf-binary": ["glb"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "audio/mpeg": ["mp3"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
};

export const extensionMatches = (name: string, mime: ProjectAssetMime): boolean =>
  EXTENSIONS[mime].includes(name.slice(name.lastIndexOf(".") + 1));

export const mimeOfName = (name: string): ProjectAssetMime | null =>
  PROJECT_ASSET_MIMES.find((mime) => extensionMatches(name, mime)) ?? null;
