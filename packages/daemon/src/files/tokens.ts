import { ASSET_URL_TTL_MS, type ProjectAssetMime } from "@kibo/schema";
import { createGrantTokens, type GrantTokens, type GrantTokensOptions } from "../components/grant-tokens";

type FileGrant = { projectId: string; name: string; mime: ProjectAssetMime };
type FileTokens = GrantTokens<FileGrant>;
type FileTokensOptions = GrantTokensOptions;

export const createFileTokens = (opts: FileTokensOptions = {}): FileTokens =>
  createGrantTokens<FileGrant>({ ttlMs: ASSET_URL_TTL_MS, ...opts });
