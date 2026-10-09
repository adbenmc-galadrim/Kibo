import {
  type ComponentOrigin,
  type ComponentVersionSummary,
  type GrantedPermissions,
  grantedOf,
  type MarketTrustInfo,
} from "@kibo/schema";

export type TrustTarget = {
  id: string;
  title: string;
  version: string;
  hash: string;
  origin: ComponentOrigin;
  permissions: GrantedPermissions;
  market?: MarketTrustInfo | null;
  selection?: boolean;
  embeds?: readonly string[];
};

export function trustTargetOf(id: string, title: string, v: ComponentVersionSummary): TrustTarget | null {
  if (!v.hash || !v.manifest) return null;
  return {
    id,
    title,
    version: v.version,
    hash: v.hash,
    origin: v.origin,
    permissions: grantedOf(v.manifest),
    selection: v.manifest.selection,
    embeds: v.manifest.embeds,
  };
}
