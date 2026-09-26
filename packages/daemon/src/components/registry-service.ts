import { getRegistryVersion, readRegistry, removeRegistryVersion, updateRegistryVersion } from "@kibo/core";
import {
  ApprovableTrust,
  type ComponentManifest,
  ComponentRef,
  type ComponentSummary,
  type ComponentUsage,
  formatRef,
  grantedOf,
  isActive,
  isBuiltinId,
  KiboError,
  type RegistryVersion,
  Sha256,
  splitRef,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { BackendSource } from "./backends";
import type { EventLog } from "./events";
import type { ActiveVersion } from "./gate";
import { findUsages, listComponents, type ProjectRef, withoutVersion } from "./registry-listing";
import { backendCodeOf, type ComponentStore, type StoredVersion } from "./store";

export type { ProjectRef } from "./registry-listing";
export type RegistryServiceDeps = {
  workspace: LoroDoc;
  persistWorkspace(): void;
  projects(): ProjectRef[];
  store: ComponentStore;
  events: EventLog;
  stopBackend(ref: string): void;
  emit(): void;
  onApproved?: (id: string, v: RegistryVersion) => Promise<void>;
};
export type RegistryService = {
  list(): ComponentSummary[];
  usages(id: string, version?: string): ComponentUsage[];
  active(ref: string): ActiveVersion;
  source(ref: string): BackendSource | null;
  stored(ref: string): StoredVersion | null;
  manifestOf(ref: string): Promise<ComponentManifest>;
  approve(id: string, version: string, hash: string, trust: ApprovableTrust): Promise<RegistryVersion>;
  revoke(id: string, version: string): RegistryVersion;
  rehash(id: string, version: string): Promise<RegistryVersion>;
  uninstall(id: string, version: string): Promise<void>;
  verify(ref: string): Promise<void>;
  verifyAll(): Promise<string[]>;
  isTampered(ref: string): boolean;
};

function checkedRef(id: string, version: string): string {
  const ref = formatRef(id, version);
  if (!ComponentRef.safeParse(ref).success)
    throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
  return ref;
}

function parsedRef(ref: string): { id: string; version: string } {
  if (!ComponentRef.safeParse(ref).success)
    throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
  return splitRef(ref);
}

function checkApproval(hash: string, trust: string): void {
  if (!Sha256.safeParse(hash).success) throw new KiboError("INVALID_INPUT", "invalid component hash");
  if (!ApprovableTrust.safeParse(trust).success)
    throw new KiboError("INVALID_INPUT", `invalid trust ${trust}`);
}

async function loadForApproval(store: ComponentStore, id: string, version: string, hash: string) {
  try {
    return await store.load(id, version, hash);
  } catch (e) {
    if (e instanceof KiboError && e.code === "TRUST_REQUIRED") {
      throw new KiboError("HASH_MISMATCH", `${id}@${version} changed on disk`);
    }
    throw e;
  }
}

export function createRegistryService(deps: RegistryServiceDeps): RegistryService {
  const tampered = new Set<string>();
  const ws = deps.workspace;
  const changed = () => {
    deps.persistWorkspace();
    deps.emit();
  };
  const versionOf = (id: string, version: string): RegistryVersion => {
    const v = getRegistryVersion(ws, id, version);
    if (!v) throw new KiboError("NOT_FOUND", `${id}@${version} is not installed`);
    return v;
  };
  const markTampered = (id: string, version: string) => {
    const ref = formatRef(id, version);
    if (tampered.has(ref)) return;
    tampered.add(ref);
    updateRegistryVersion(ws, id, version, { trust: null });
    deps.events.record({ projectId: "-", instanceId: "-", ref, kind: "verify", code: "TRUST_REQUIRED" });
    deps.stopBackend(ref);
    changed();
  };
  const checkIntact = async (id: string, version: string, hash: string) => {
    if (await deps.store.verify(id, version, hash)) return true;
    markTampered(id, version);
    return false;
  };
  const approved = (ref: string): ActiveVersion | null => {
    const { id, version } = parsedRef(ref);
    const v = getRegistryVersion(ws, id, version);
    if (!v || !isActive(v) || tampered.has(ref) || v.trust === "builtin" || v.trust === null) return null;
    return { ref, trust: v.trust, granted: v.granted };
  };
  const active = (ref: string): ActiveVersion => {
    const a = approved(ref);
    if (!a) throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
    return a;
  };
  const stored = (ref: string): StoredVersion | null => {
    if (!approved(ref)) return null;
    const { id, version } = splitRef(ref);
    return deps.store.get(id, version) ?? null;
  };

  return {
    list: () =>
      listComponents(ws, {
        projects: deps.projects(),
        store: deps.store,
        isTampered: (r) => tampered.has(r),
      }),
    usages: (id, version) => findUsages(deps.projects(), id, version).map(withoutVersion),
    active,
    stored,
    source(ref) {
      const s = stored(ref);
      const a = approved(ref);
      if (!s || !a) return null;
      return { manifest: s.manifest, code: backendCodeOf(s), trust: a.trust };
    },
    async manifestOf(ref) {
      const { id, version } = parsedRef(ref);
      const v = versionOf(id, version);
      return (deps.store.get(id, version) ?? (await deps.store.load(id, version, v.hash))).manifest;
    },
    async approve(id, version, hash, trust) {
      const ref = checkedRef(id, version);
      checkApproval(hash, trust);
      if (isBuiltinId(id)) throw new KiboError("INVALID_INPUT", `${id} is a built-in component`);
      const v = versionOf(id, version);
      if (hash !== v.hash) throw new KiboError("HASH_MISMATCH", `${ref} hash is ${v.hash}`);
      const s = await loadForApproval(deps.store, id, version, hash);
      tampered.delete(ref);
      let updated = updateRegistryVersion(ws, id, version, {
        trust,
        approvedHash: hash,
        granted: grantedOf(s.manifest),
      });
      deps.stopBackend(ref);
      changed();
      if (updated.autoUpdate) {
        updated = updateRegistryVersion(ws, id, version, { autoUpdate: false });
        changed();
        await deps.onApproved?.(id, updated);
      }
      return updated;
    },
    revoke(id, version) {
      const ref = checkedRef(id, version);
      versionOf(id, version);
      const updated = updateRegistryVersion(ws, id, version, { trust: null, approvedHash: null });
      deps.stopBackend(ref);
      changed();
      return updated;
    },
    async rehash(id, version) {
      const ref = checkedRef(id, version);
      const v = versionOf(id, version);
      if (!(await checkIntact(id, version, v.hash))) {
        throw new KiboError("TRUST_REQUIRED", `${ref} still differs from its hash`);
      }
      if (tampered.delete(ref)) changed();
      return versionOf(id, version);
    },
    async uninstall(id, version) {
      const ref = checkedRef(id, version);
      versionOf(id, version);
      if (findUsages(deps.projects(), id, version).length > 0) {
        throw new KiboError("INVALID_INPUT", `${ref} is still used on pages`);
      }
      deps.stopBackend(ref);
      removeRegistryVersion(ws, id, version);
      await deps.store.remove(id, version);
      tampered.delete(ref);
      changed();
    },
    async verify(ref) {
      const { id, version } = parsedRef(ref);
      const v = versionOf(id, version);
      if (!(await checkIntact(id, version, v.hash))) {
        throw new KiboError("TRUST_REQUIRED", `${ref} changed on disk`);
      }
      active(ref);
    },
    async verifyAll() {
      const bad: string[] = [];
      for (const [id, entry] of Object.entries(readRegistry(ws))) {
        for (const v of Object.values(entry.versions)) {
          if (!(await checkIntact(id, v.version, v.hash))) bad.push(formatRef(id, v.version));
        }
      }
      return bad;
    },
    isTampered: (ref) => tampered.has(ref),
  };
}
