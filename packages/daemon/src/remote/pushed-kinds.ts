import { SnapshotKind } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import type { Store } from "../store";

export const PUSHED_KINDS_KEY = "remote.pushedKinds";

const Ledger = z.record(z.string(), z.array(SnapshotKind));
type Ledger = z.infer<typeof Ledger>;

export type PushedKinds = {
  kinds(projectId: string): SnapshotKind[];
  projects(): string[];
  add(projectId: string, kind: SnapshotKind): void;
  remove(projectId: string, kind: SnapshotKind): void;
  forget(projectId: string): void;
};

function parseLedger(raw: string | null): Ledger {
  if (raw === null) return {};
  try {
    return Ledger.parse(JSON.parse(raw));
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${PUSHED_KINDS_KEY} is invalid: ${String(e)}`);
  }
}

export function openPushedKinds(store: Pick<Store, "getLocal" | "setLocal">): PushedKinds {
  const read = () => parseLedger(store.getLocal(PUSHED_KINDS_KEY));
  const update = (projectId: string, change: (kinds: SnapshotKind[]) => SnapshotKind[]) => {
    const ledger = read();
    const before = ledger[projectId] ?? [];
    const after = change(before);
    if (after.length === before.length && after.every((kind, i) => kind === before[i])) return;
    if (after.length === 0) delete ledger[projectId];
    else ledger[projectId] = after;
    store.setLocal(PUSHED_KINDS_KEY, JSON.stringify(ledger));
  };
  return {
    kinds: (projectId) => read()[projectId] ?? [],
    projects: () => Object.keys(read()),
    add: (projectId, kind) => update(projectId, (kinds) => (kinds.includes(kind) ? kinds : [...kinds, kind])),
    remove: (projectId, kind) => update(projectId, (kinds) => kinds.filter((k) => k !== kind)),
    forget: (projectId) => update(projectId, () => []),
  };
}
