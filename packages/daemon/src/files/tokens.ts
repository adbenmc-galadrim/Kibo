import { ASSET_URL_TTL_MS, type ProjectAssetMime } from "@kibo/schema";
import { createGrantTokens, type GrantTokens, type GrantTokensOptions } from "../components/grant-tokens";

export type FileGrant = { projectId: string; name: string; mime: ProjectAssetMime };
export type FileTokens = GrantTokens<FileGrant>;
export type FileTokensOptions = GrantTokensOptions;

export const createFileTokens = (opts: FileTokensOptions = {}): FileTokens =>
  createGrantTokens<FileGrant>({ ttlMs: ASSET_URL_TTL_MS, ...opts });
