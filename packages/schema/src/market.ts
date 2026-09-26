import { z } from "zod";
import type { MarketTrustInfo, TrustPreview } from "./component";
import { Base64, Sha256 } from "./ids";
import { ComponentId, ComponentKind, ComponentManifest } from "./manifest";
import { GrantedPermissions } from "./permissions";
import { SemVer } from "./semver";

export const KpkgFile = z.object({ path: z.string().min(1), sha256: Sha256, content: Base64 });
export type KpkgFile = z.infer<typeof KpkgFile>;

export const Kpkg = z.object({
  format: z.literal(1),
  manifest: ComponentManifest,
  files: z.array(KpkgFile).min(1),
  hash: Sha256,
  publisher: z.object({ name: z.string().min(1).max(64), publicKey: Base64 }),
  publishedAt: z.string().datetime(),
  signature: Base64,
});
export type Kpkg = z.infer<typeof Kpkg>;

export const MarketIndex = z.object({
  format: z.literal(1),
  source: z.object({ id: z.string(), name: z.string(), publicKey: z.string() }),
  serial: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  publishers: z.array(z.object({ publicKey: z.string(), name: z.string(), verified: z.boolean() })),
  packages: z.array(
    z.object({
      id: ComponentId,
      title: z.string(),
      description: z.string(),
      kind: ComponentKind,
      versions: z.array(
        z.object({
          version: SemVer,
          hash: Sha256,
          publisherKey: z.string(),
          size: z.number().int(),
          permissions: GrantedPermissions,
          publishedAt: z.string().datetime(),
          url: z.string(),
        }),
      ),
    }),
  ),
  revoked: z.array(z.object({ hash: Sha256, reason: z.string() })),
});
export type MarketIndex = z.infer<typeof MarketIndex>;

export const KPKG_MAX_BYTES = 2 * 1024 * 1024;
export const MARKET_FETCH_TIMEOUT_MS = 30_000;
export const MARKET_REFRESH_MS = 6 * 3_600_000;

export type MarketSourceInfo = {
  id: string;
  name: string;
  url: string;
  publicKey: string;
  fingerprint: string;
  lastSerial: number | null;
  lastFetchedAt: number | null;
  lastError: string | null;
  enabled: boolean;
};
export type MarketProbe = {
  sourceId: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  serial: number;
  packages: number;
};
export type MarketHit = {
  sourceId: string;
  sourceName: string;
  id: string;
  title: string;
  description: string;
  kind: ComponentKind;
  latest: string;
  publisher: { name: string; publicKey: string; verified: boolean };
  installed: string | null;
  updateAvailable: string | null;
};
export type MarketVersionInfo = {
  version: string;
  hash: string;
  size: number;
  permissions: GrantedPermissions;
  publishedAt: string;
  revoked: string | null;
};
export type MarketPackageDetail = MarketHit & {
  version: string;
  hash: string;
  size: number;
  permissions: GrantedPermissions;
  versions: MarketVersionInfo[];
  pinnedPublisher: string | null;
  newPublisher: boolean;
  publisherChanged: boolean;
  files: { path: string; content: string }[];
};
export type MarketInstallResult = Omit<TrustPreview, "origin" | "market"> & { market: MarketTrustInfo };
