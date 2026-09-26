import { ComponentManifest, Sha256 } from "@kibo/schema";
import type { StoredVersion } from "./store";

export type AssetLookup = (
  id: string,
  version: string,
  hash: string,
) => { stored: StoredVersion; trust: "trusted" | "sandboxed" } | null;

export type AssetRequest<F extends string> = { id: string; version: string; hash: string; file: F };

const ComponentKey = ComponentManifest.pick({ id: true, version: true });

export function parseAssetPath<F extends string>(
  pathname: string,
  prefix: "c" | "components",
  files: readonly F[],
): AssetRequest<F> | null {
  const parts = pathname.split("/");
  if (parts.length !== 6 || parts[0] !== "" || parts[1] !== prefix) return null;
  const [, , id, version, hash, name] = parts;
  const file = files.find((f) => f === name);
  if (file === undefined) return null;
  const key = ComponentKey.safeParse({ id, version });
  const digest = Sha256.safeParse(hash);
  if (!key.success || !digest.success) return null;
  return { id: key.data.id, version: key.data.version, hash: digest.data, file };
}

export function lookupAsset<F extends string>(
  assets: AssetLookup,
  req: AssetRequest<F>,
): { stored: StoredVersion; trust: "trusted" | "sandboxed" } | null {
  const found = assets(req.id, req.version, req.hash);
  if (!found) return null;
  const { stored } = found;
  if (stored.id !== req.id || stored.version !== req.version || stored.hash !== req.hash) return null;
  return found;
}
