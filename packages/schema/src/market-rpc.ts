import { z } from "zod";
import { Sha256 } from "./ids";
import { ComponentId, ComponentKind } from "./manifest";
import type {
  Kpkg,
  MarketHit,
  MarketInstallResult,
  MarketPackageDetail,
  MarketProbe,
  MarketSourceInfo,
} from "./market";
import { SemVer } from "./semver";

const sourceId = z.string().min(1).max(64);
const url = z.string().min(1).max(2048);
const publisherName = z.string().trim().min(1).max(64);

export const MARKET_RPC_REQUESTS = [
  z.object({ method: z.literal("listMarketSources") }),
  z.object({ method: z.literal("probeMarketSource"), url }),
  z.object({ method: z.literal("addMarketSource"), url, publicKey: z.string().min(1) }),
  z.object({ method: z.literal("removeMarketSource"), id: sourceId }),
  z.object({ method: z.literal("refreshMarket") }),
  z.object({
    method: z.literal("searchMarket"),
    query: z.string().max(200),
    sourceId: sourceId.optional(),
    kind: ComponentKind.optional(),
  }),
  z.object({ method: z.literal("getMarketPackage"), sourceId, id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("unpinPublisher"), sourceId, componentId: ComponentId }),
  z.object({
    method: z.literal("findMarketSource"),
    id: ComponentId,
    version: SemVer,
    hash: Sha256.nullable(),
  }),
  z.object({ method: z.literal("installFromMarket"), sourceId, id: ComponentId, version: SemVer }),
  z.object({
    method: z.literal("publishToMarket"),
    id: ComponentId,
    version: SemVer,
    sourceId,
    publisherName: publisherName.optional(),
  }),
  z.object({
    method: z.literal("exportKpkg"),
    id: ComponentId,
    version: SemVer,
    publisherName: publisherName.optional(),
  }),
] as const;

export type MarketRpcRequest = z.infer<(typeof MARKET_RPC_REQUESTS)[number]>;

export type MarketRpcResult = {
  listMarketSources: MarketSourceInfo[];
  probeMarketSource: MarketProbe;
  addMarketSource: MarketSourceInfo;
  removeMarketSource: null;
  refreshMarket: null;
  searchMarket: MarketHit[];
  getMarketPackage: MarketPackageDetail;
  unpinPublisher: null;
  findMarketSource: { sourceId: string } | null;
  installFromMarket: MarketInstallResult;
  publishToMarket: { serial: number };
  exportKpkg: Kpkg;
};
