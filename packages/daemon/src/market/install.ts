import type { OsSandbox } from "@kibo/devkit";
import {
  grantedOf,
  KiboError,
  type MarketInstallResult,
  NO_PERMISSIONS,
  type ValidationReport,
} from "@kibo/schema";
import type { PublishLock } from "../components/publish-lock";
import type { ComponentStore } from "../components/store";
import { validationFailures, withPrivateSources } from "./install-sources";
import type { FetchedPackage, MarketService, PackageRef, RegistryPort } from "./market-service";

export { purgeInstallDirs } from "./install-sources";

export type InstallDeps = {
  market: Pick<
    MarketService,
    "fetchVerified" | "assertListed" | "pinPublisher" | "unpinPublisher" | "search"
  >;
  store: Pick<ComponentStore, "put" | "verify" | "remove">;
  registry: RegistryPort;
  validate(dir: string): Promise<ValidationReport>;
  sandbox: Pick<OsSandbox, "ready">;
  lock: PublishLock;
  tmpRoot: string;
  log(message: string, error: unknown): void;
};

const labelOf = (input: PackageRef) => `${input.id}@${input.version}`;
const assertListed = (deps: InstallDeps, fetched: FetchedPackage, input: PackageRef) =>
  deps.market.assertListed(input, fetched.pkg.hash, fetched.pkg.publisher.publicKey);

async function storeValidated(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): Promise<void> {
  await withPrivateSources(deps.tmpRoot, fetched.files, async (dir) => {
    const report = await deps.validate(dir);
    if (!report.ok)
      throw new KiboError("VALIDATION_FAILED", `${labelOf(input)}: ${validationFailures(report)}`);
    assertListed(deps, fetched, input);
    await deps.store.put(dir, fetched.pkg.hash);
  });
}

function assertRequested(fetched: FetchedPackage, input: PackageRef): void {
  const { id, version } = fetched.pkg.manifest;
  if (id !== input.id || version !== input.version) {
    throw new KiboError("INVALID_INPUT", `${labelOf(input)} was served as ${id}@${version}`);
  }
}

function assertNotInstalledElsewhere(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): boolean {
  const existing = deps.registry.get(input.id, input.version);
  if (existing && existing.hash !== fetched.pkg.hash)
    throw new KiboError("VERSION_EXISTS", `${labelOf(input)} is installed with another hash`);
  return existing !== null;
}

function register(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): void {
  const { pkg } = fetched;
  assertListed(deps, fetched, input);
  if (assertNotInstalledElsewhere(deps, fetched, input)) return;
  deps.registry.put(input.id, pkg.manifest.title, {
    version: input.version,
    hash: pkg.hash,
    origin: "marketplace",
    trust: null,
    approvedHash: null,
    granted: NO_PERMISSIONS,
    publishedAt: Date.parse(pkg.publishedAt),
    autoUpdate: false,
    source: { sourceId: input.sourceId, publisherKey: pkg.publisher.publicKey },
    revoked: null,
  });
}

function resultOf(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): MarketInstallResult {
  const hit = deps.market
    .search({ query: input.id, sourceId: input.sourceId })
    .find((h) => h.id === input.id);
  return {
    id: input.id,
    title: fetched.pkg.manifest.title,
    version: input.version,
    hash: fetched.pkg.hash,
    permissions: grantedOf(fetched.pkg.manifest),
    market: {
      publisherName: fetched.publisher.name,
      verified: fetched.publisher.verified,
      sourceName: hit?.sourceName ?? input.sourceId,
      newPublisher: fetched.newPublisher,
    },
  };
}

async function rollback(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): Promise<void> {
  try {
    if (fetched.newPublisher) deps.market.unpinPublisher({ sourceId: input.sourceId, componentId: input.id });
    await deps.store.remove(input.id, input.version);
  } catch (failure) {
    deps.log(`market: cleanup after a failed install of ${labelOf(input)} failed`, failure);
  }
}

async function install(deps: InstallDeps, input: PackageRef): Promise<MarketInstallResult> {
  const fetched = await deps.market.fetchVerified(input);
  assertRequested(fetched, input);
  const result = resultOf(deps, fetched, input);
  if (
    assertNotInstalledElsewhere(deps, fetched, input) &&
    (await deps.store.verify(input.id, input.version, fetched.pkg.hash))
  )
    return result;
  await deps.sandbox.ready();
  await storeValidated(deps, fetched, input);
  try {
    if (fetched.newPublisher)
      deps.market.pinPublisher(input.sourceId, input.id, fetched.pkg.publisher.publicKey);
    register(deps, fetched, input);
  } catch (e) {
    await rollback(deps, fetched, input);
    throw e;
  }
  return result;
}

export function installFromMarket(deps: InstallDeps, input: PackageRef): Promise<MarketInstallResult> {
  return deps.lock.hold(input.id, () => install(deps, input));
}
