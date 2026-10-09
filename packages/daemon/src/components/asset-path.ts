import {
  type Capability,
  ComponentManifest,
  DraftId,
  ProjectAssetName,
  type SandboxFile,
  Sha256,
} from "@kibo/schema";
import type { StoredVersion } from "./store";

export type FoundAsset = {
  stored: StoredVersion;
  trust: "trusted" | "sandboxed";
  capabilities: readonly Capability[];
};
export type AssetLookup = (id: string, version: string, hash: string) => FoundAsset | null;

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

export function lookupAsset<F extends string>(assets: AssetLookup, req: AssetRequest<F>): FoundAsset | null {
  const found = assets(req.id, req.version, req.hash);
  if (!found) return null;
  const { stored } = found;
  if (stored.id !== req.id || stored.version !== req.version || stored.hash !== req.hash) return null;
  return found;
}

export type DraftAssetRequest = { draftId: string; hash: string; file: SandboxFile };

const DRAFT_FILES: readonly SandboxFile[] = ["index.html", "ui.sandbox.js", "ui.css"];
const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseDraftAssetPath(pathname: string): DraftAssetRequest | null {
  const parts = pathname.split("/");
  if (parts.length !== 6 || parts[0] !== "" || parts[1] !== "c" || parts[2] !== "drafts") return null;
  const [, , , draftId = "", hash, name] = parts;
  const file = DRAFT_FILES.find((f) => f === name);
  if (file === undefined || !LOWERCASE_UUID.test(draftId)) return null;
  const id = DraftId.safeParse(draftId);
  const digest = Sha256.safeParse(hash);
  if (!id.success || !digest.success) return null;
  return { draftId: id.data, hash: digest.data, file };
}

const FILE_TOKEN = /^[0-9a-f]{64}$/;

export function parseFilePath(pathname: string): { token: string; name: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "f") return null;
  const [, , token = "", name = ""] = parts;
  if (!FILE_TOKEN.test(token) || !ProjectAssetName.safeParse(name).success) return null;
  return { token, name };
}

const DESIGN_NAME = /^frame\.(png|webp|jpg)$/;

export function parseDesignPath(pathname: string): { token: string; name: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "d") return null;
  const [, , token = "", name = ""] = parts;
  if (!FILE_TOKEN.test(token) || !DESIGN_NAME.test(name)) return null;
  return { token, name };
}

export function parseEmbedPath(pathname: string): { token: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== "" || parts[1] !== "e") return null;
  const token = parts[2] ?? "";
  return FILE_TOKEN.test(token) ? { token } : null;
}
