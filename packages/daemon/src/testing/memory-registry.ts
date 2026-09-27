import type { RegistryVersion } from "@kibo/schema";
import type { RegistryPort } from "../market/market-service";

type Row = { id: string; title: string; version: string; v: RegistryVersion };
type Revoked = { id: string; version: string; reason: string };

export function createMemoryRegistry(): { port: RegistryPort; revoked: Revoked[] } {
  const rows = new Map<string, Row>();
  const revoked: Revoked[] = [];
  const port: RegistryPort = {
    get: (id, version) => rows.get(`${id}@${version}`)?.v ?? null,
    put: (id, title, v) => {
      rows.set(`${id}@${v.version}`, { id, title, version: v.version, v });
    },
    installed: () => [...rows.values()],
    revoke: (id, version, reason, at) => {
      const row = rows.get(`${id}@${version}`);
      if (!row) return;
      rows.set(`${id}@${version}`, {
        ...row,
        v: { ...row.v, trust: null, approvedHash: null, revoked: { reason, at } },
      });
      revoked.push({ id, version, reason });
    },
  };
  return { port, revoked };
}
