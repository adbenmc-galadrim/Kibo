import type { LoroDoc } from "loro-crdt";
import type { SyncHost } from "../project-sync";

export type MemoryHost = SyncHost & { replaced: number; current(): LoroDoc };

export function createMemoryHost(initial: LoroDoc): MemoryHost {
  let doc = initial;
  const host: MemoryHost = {
    replaced: 0,
    doc: () => doc,
    current: () => doc,
    applyRemote: (bytes) => {
      doc.import(bytes);
    },
    replaceDoc: (next) => {
      doc = next;
      host.replaced += 1;
    },
  };
  return host;
}
