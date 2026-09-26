import { getRegistryVersion, highestVersion, putRegistryVersion, readRegistry } from "@kibo/core";
import {
  addedPermissions,
  type ComponentManifest,
  type ComponentUsage,
  compareSemver,
  formatRef,
  grantedOf,
  isActive,
  isKiboErrorCode,
  KiboError,
  NO_PERMISSIONS,
  type PublishPreview,
  type PublishResult,
  type PublishUsage,
  permissionList,
  type RegistryEntry,
  type RegistryVersion,
  type ValidationReport,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { draftDir, readDraftManifest } from "./drafts";
import type { RegistryService } from "./registry-service";
import type { ComponentStore } from "./store";

export type PublisherDeps = {
  home: string;
  workspace: LoroDoc;
  persistWorkspace(): void;
  emit(): void;
  store: ComponentStore;
  registry: RegistryService;
  validate(dir: string): Promise<ValidationReport>;
  update(projectId: string, instanceId: string, to: string): Promise<unknown>;
  now?: () => number;
};
export type Publisher = {
  preview(id: string): Promise<PublishPreview>;
  publish(id: string, strategy: "update-all" | "new-version"): Promise<PublishResult>;
  applyUpdateAll(id: string, version: string): Promise<PublishResult["failed"]>;
};
type Failure = PublishResult["failed"][number];

const passedHash = (v: ValidationReport): string | null => (v.ok ? v.hash : null);

function reportErrors(v: ValidationReport): string {
  const errors = [
    ...v.manifest.errors,
    ...v.imports.errors,
    ...v.typecheck.errors,
    ...v.conformance.errors,
    ...v.permissions.errors,
  ];
  return errors.length > 0 ? errors.join("; ") : "validation is not green";
}

function statusOf(
  entry: RegistryEntry | undefined,
  version: string,
  hash: string | null,
): PublishPreview["status"] {
  const from = entry ? highestVersion(entry) : null;
  if (hash === null) return from === null ? "new" : "update";
  const same = entry?.versions[version];
  if (same) {
    if (same.hash !== hash)
      throw new KiboError("VERSION_EXISTS", `${version} is already published with another hash`);
    return "unchanged";
  }
  if (from !== null && compareSemver(version, from) <= 0)
    throw new KiboError("INVALID_INPUT", `${version} must be higher than ${from}`);
  return from === null ? "new" : "update";
}

function failureOf(u: ComponentUsage, e: unknown): Failure {
  const known = e instanceof KiboError && isKiboErrorCode(e.code);
  if (!known) console.error(`[kibo-daemon] update of ${u.instanceId} failed`, e);
  return {
    instanceId: u.instanceId,
    projectName: u.projectName,
    pageTitle: u.pageTitle,
    code: known ? e.code : "INTERNAL",
    message: known ? e.detail : "internal error",
  };
}

export function createPublisher(deps: PublisherDeps): Publisher {
  const ws = deps.workspace;

  const context = async (id: string): Promise<{ dir: string; manifest: ComponentManifest }> => {
    const dir = await draftDir(deps.home, id);
    const manifest = await readDraftManifest(dir);
    if (!manifest || manifest.id !== id)
      throw new KiboError("VALIDATION_FAILED", `invalid manifest for ${id}`);
    return { dir, manifest };
  };

  const previousManifest = async (id: string, from: string | null): Promise<ComponentManifest | null> => {
    if (from === null) return null;
    try {
      return await deps.registry.manifestOf(formatRef(id, from));
    } catch (e) {
      if (e instanceof KiboError && e.code === "TRUST_REQUIRED") return null;
      throw e;
    }
  };

  const usagesOf = (id: string): PublishUsage[] =>
    deps.registry
      .list()
      .filter((c) => c.id === id)
      .flatMap((c) => c.versions.flatMap((v) => v.usages.map((u) => ({ ...u, version: v.version }))));

  const preview = async (id: string): Promise<PublishPreview> => {
    const { dir, manifest } = await context(id);
    const validation = await deps.validate(dir);
    const entry = readRegistry(ws)[id];
    const status = statusOf(entry, manifest.version, passedHash(validation));
    const from = entry ? highestVersion(entry) : null;
    const prev = from ? getRegistryVersion(ws, id, from) : null;
    const prevManifest = await previousManifest(id, from);
    const granted = grantedOf(manifest);
    const migrates = prevManifest !== null && manifest.configVersion > prevManifest.configVersion;
    return {
      id,
      title: manifest.title,
      from,
      to: manifest.version,
      hash: validation.hash,
      status,
      usages: usagesOf(id),
      changes: manifest.changes,
      newPermissions:
        prev && isActive(prev) ? addedPermissions(prev.granted, granted) : permissionList(granted),
      migration: migrates ? { from: prevManifest.configVersion, to: manifest.configVersion } : null,
      validation,
    };
  };

  const applyUpdateAll = async (id: string, version: string): Promise<Failure[]> => {
    const failed: Failure[] = [];
    for (const u of deps.registry.usages(id)) {
      try {
        await deps.update(u.projectId, u.instanceId, version);
      } catch (e) {
        failed.push(failureOf(u, e));
      }
    }
    return failed;
  };

  const inheritedTrust = (prev: RegistryVersion | null, p: PublishPreview) => {
    if (!prev || !isActive(prev) || p.newPermissions.length > 0) return null;
    return prev.trust === "trusted" || prev.trust === "sandboxed" ? prev.trust : null;
  };

  const publish = async (id: string, strategy: "update-all" | "new-version"): Promise<PublishResult> => {
    const p = await preview(id);
    const hash = passedHash(p.validation);
    if (hash === null) throw new KiboError("VALIDATION_FAILED", `${id}: ${reportErrors(p.validation)}`);
    if (p.status === "unchanged") {
      const existing = getRegistryVersion(ws, id, p.to);
      if (!existing) throw new KiboError("INTERNAL", `${id}@${p.to} vanished`);
      return { version: existing, needsApproval: !isActive(existing), updated: [], failed: [] };
    }
    const { dir, manifest } = await context(id);
    const stored = await deps.store.put(dir, hash);
    const trust = inheritedTrust(p.from ? getRegistryVersion(ws, id, p.from) : null, p);
    const usages = deps.registry.usages(id);
    const version: RegistryVersion = {
      version: stored.version,
      hash: stored.hash,
      origin: "user",
      trust,
      approvedHash: trust ? stored.hash : null,
      granted: trust ? grantedOf(manifest) : NO_PERMISSIONS,
      publishedAt: (deps.now ?? Date.now)(),
      autoUpdate: trust === null && strategy === "update-all" && usages.length > 0,
    };
    putRegistryVersion(ws, id, manifest.title, version);
    deps.persistWorkspace();
    deps.emit();
    if (trust === null || strategy === "new-version" || usages.length === 0) {
      return { version, needsApproval: trust === null, updated: [], failed: [] };
    }
    const failed = await applyUpdateAll(id, version.version);
    const failedIds = new Set(failed.map((f) => f.instanceId));
    const updated = usages.map((u) => u.instanceId).filter((x) => !failedIds.has(x));
    return { version, needsApproval: false, updated, failed };
  };

  return { preview, publish, applyUpdateAll };
}
