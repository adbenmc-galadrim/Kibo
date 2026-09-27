import { join } from "node:path";
import { readSources } from "@kibo/devkit";
import { ComponentManifest, KiboError, type Kpkg, type ValidationReport } from "@kibo/schema";
import { encodeKpkg, packKpkg, type SourceFile } from "@kibo/trust";
import type { SyncConfig } from "../collab/sync-db";
import type { PublishLock } from "../components/publish-lock";
import type { ComponentStore } from "../components/store";
import { validationFailures, withPrivateSources } from "./install-sources";
import type { MarketService, RegistryPort } from "./market-service";
import { httpOrigin, type PublishRequestDeps, sendPackage } from "./publish-request";
import { loadPublisherKeys } from "./publisher-keys";

export type PublishDeps = PublishRequestDeps & {
  store: Pick<ComponentStore, "root">;
  registry: RegistryPort;
  market: Pick<MarketService, "sourceUrl" | "refresh" | "hasVersion">;
  syncConfig(): SyncConfig | null;
  validate(dir: string): Promise<ValidationReport>;
  lock: PublishLock;
  tmpRoot: string;
};
type Ref = { id: string; version: string };
type PublishInput = Ref & { sourceId: string; publisherName?: string };

const MANIFEST_FILE = "kibo.component.json";
const OWN_ORIGINS: ReadonlySet<string> = new Set(["user", "ai"]);
const labelOf = (input: Ref) => `${input.id}@${input.version}`;

async function ownSources(deps: PublishDeps, input: Ref): Promise<SourceFile[]> {
  const v = deps.registry.get(input.id, input.version);
  if (!v) throw new KiboError("NOT_FOUND", `${labelOf(input)} is not published locally`);
  if (!OWN_ORIGINS.has(v.origin))
    throw new KiboError("INVALID_INPUT", `${input.id} is not one of your components`);
  const { hash, files } = await readSources(join(deps.store.root, input.id, input.version, v.hash, "source"));
  if (hash !== v.hash) throw new KiboError("HASH_MISMATCH", `${labelOf(input)} changed in the store`);
  return files;
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function manifestOf(files: SourceFile[], input: Ref): ComponentManifest {
  const file = files.find((f) => f.path === MANIFEST_FILE);
  if (!file) throw new KiboError("INVALID_INPUT", `${input.id} has no manifest`);
  const parsed = ComponentManifest.safeParse(parseJson(file.bytes));
  if (!parsed.success || parsed.data.id !== input.id || parsed.data.version !== input.version)
    throw new KiboError("INVALID_INPUT", `${labelOf(input)} has an unexpected manifest`);
  return parsed.data;
}

export async function exportKpkg(deps: PublishDeps, input: Ref & { publisherName?: string }): Promise<Kpkg> {
  const files = await ownSources(deps, input);
  const keys = await loadPublisherKeys(deps.secrets, input.publisherName);
  return packKpkg({
    manifest: manifestOf(files, input),
    files,
    publisherName: keys.name,
    keys: { publicKey: keys.publicKey, privateKey: keys.privateKey },
    publishedAt: new Date(deps.now()),
  });
}

async function validateGeneric(deps: PublishDeps, input: Ref): Promise<void> {
  const files = await ownSources(deps, input);
  await withPrivateSources(deps.tmpRoot, files, async (dir) => {
    const report = await deps.validate(dir);
    if (!report.ok)
      throw new KiboError("VALIDATION_FAILED", `${labelOf(input)}: ${validationFailures(report)}`);
  });
}

function assertTeamSource(deps: PublishDeps, config: SyncConfig, sourceId: string): void {
  const url = new URL(deps.market.sourceUrl(sourceId));
  if (url.origin !== httpOrigin(config.serverUrl) || url.pathname !== "/market/")
    throw new KiboError("INVALID_INPUT", `${sourceId} is not the team source of the sync server`);
}

async function publish(deps: PublishDeps, input: PublishInput): Promise<{ serial: number }> {
  const config = deps.syncConfig();
  if (!config) throw new KiboError("SYNC_OFFLINE", "connect to a sync server before publishing");
  assertTeamSource(deps, config, input.sourceId);
  await validateGeneric(deps, input);
  await deps.market.refresh(input.sourceId);
  if (deps.market.hasVersion(input.sourceId, input.id, input.version))
    throw new KiboError("VERSION_EXISTS", `${labelOf(input)} is already on ${input.sourceId}`);
  const pkg = await exportKpkg(deps, input);
  const publisher = await loadPublisherKeys(deps.secrets);
  const serial = await sendPackage(deps, {
    config,
    sourceId: input.sourceId,
    publisher,
    body: encodeKpkg(pkg),
  });
  await deps.market
    .refresh(input.sourceId)
    .catch((e: unknown) => deps.log(`market: refresh of ${input.sourceId} after publishing failed`, e));
  return { serial };
}

export function publishToMarket(deps: PublishDeps, input: PublishInput): Promise<{ serial: number }> {
  return deps.lock.hold(input.id, () => publish(deps, input));
}
