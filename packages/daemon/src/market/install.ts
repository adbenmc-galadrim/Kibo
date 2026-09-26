import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { OsSandbox } from "@kibo/devkit";
import {
  grantedOf,
  KiboError,
  type MarketInstallResult,
  NO_PERMISSIONS,
  type ValidationReport,
} from "@kibo/schema";
import type { SourceFile } from "@kibo/trust";
import type { PublishLock } from "../components/publish-lock";
import type { ComponentStore } from "../components/store";
import type { FetchedPackage, MarketService, PackageRef, RegistryPort } from "./market-service";

export type InstallDeps = {
  market: Pick<
    MarketService,
    "fetchVerified" | "assertListed" | "pinPublisher" | "unpinPublisher" | "search"
  >;
  store: Pick<ComponentStore, "put" | "remove">;
  registry: RegistryPort;
  validate(dir: string): Promise<ValidationReport>;
  sandbox: Pick<OsSandbox, "ready">;
  lock: PublishLock;
  tmpRoot: string;
};

function targetIn(dir: string, path: string): string {
  const target = resolve(dir, path);
  const rel = relative(dir, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new KiboError("INVALID_INPUT", `unsafe package path: ${JSON.stringify(path)}`);
  }
  return target;
}

async function writeSources(dir: string, files: SourceFile[]): Promise<void> {
  for (const f of files) {
    const target = targetIn(dir, f.path);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, f.bytes, { mode: 0o600, flag: "wx" });
  }
}

function failures(report: ValidationReport): string {
  const errors = [
    ...report.manifest.errors,
    ...report.imports.errors,
    ...report.typecheck.errors,
    ...report.conformance.errors,
    ...report.permissions.errors,
    ...report.permissions.missing.map((p) => `missing permission ${p}`),
    ...(report.tests.ok ? [] : ["generic conformance suite failed"]),
  ];
  return errors.length > 0 ? errors.join("; ") : "validation is not green";
}

async function storeValidated(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): Promise<void> {
  await mkdir(deps.tmpRoot, { recursive: true, mode: 0o700 });
  const dir = await mkdtemp(join(deps.tmpRoot, "install-"));
  try {
    await writeSources(dir, fetched.files);
    const report = await deps.validate(dir);
    if (!report.ok)
      throw new KiboError("VALIDATION_FAILED", `${input.id}@${input.version}: ${failures(report)}`);
    deps.market.assertListed(input, fetched.pkg.hash);
    await deps.store.put(dir, fetched.pkg.hash);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function assertRequested(fetched: FetchedPackage, input: PackageRef): void {
  const { id, version } = fetched.pkg.manifest;
  if (id !== input.id || version !== input.version) {
    throw new KiboError("INVALID_INPUT", `${input.id}@${input.version} was served as ${id}@${version}`);
  }
}

function register(deps: InstallDeps, fetched: FetchedPackage, input: PackageRef): void {
  const { pkg } = fetched;
  deps.market.assertListed(input, pkg.hash);
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

async function install(deps: InstallDeps, input: PackageRef): Promise<MarketInstallResult> {
  const fetched = await deps.market.fetchVerified(input);
  assertRequested(fetched, input);
  const result = resultOf(deps, fetched, input);
  const existing = deps.registry.get(input.id, input.version);
  if (existing && existing.hash !== fetched.pkg.hash)
    throw new KiboError("VERSION_EXISTS", `${input.id}@${input.version} is installed with another hash`);
  if (existing) return result;
  await deps.sandbox.ready();
  await storeValidated(deps, fetched, input);
  const pin = { sourceId: input.sourceId, componentId: input.id };
  try {
    if (fetched.newPublisher)
      deps.market.pinPublisher(pin.sourceId, pin.componentId, fetched.pkg.publisher.publicKey);
    register(deps, fetched, input);
  } catch (e) {
    if (fetched.newPublisher) deps.market.unpinPublisher(pin);
    await deps.store.remove(input.id, input.version);
    throw e;
  }
  return result;
}

export function installFromMarket(deps: InstallDeps, input: PackageRef): Promise<MarketInstallResult> {
  return deps.lock.hold(input.id, () => install(deps, input));
}
