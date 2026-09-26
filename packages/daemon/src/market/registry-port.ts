import {
  getRegistryVersion,
  putRegistryVersion,
  readRegistry,
  updateRegistryVersion,
} from "@kibo/core/registry";
import type { ComponentsService } from "../components/service";
import type { Docs } from "../docs";
import type { RegistryPort } from "./market-service";

export function createRegistryPort(input: {
  docs: Docs;
  components: Pick<ComponentsService, "registry" | "usageChanged" | "events">;
}): RegistryPort {
  const ws = input.docs.workspace;
  return {
    get: (id, version) => getRegistryVersion(ws, id, version),
    put: (id, title, v) => {
      putRegistryVersion(ws, id, title, v);
      input.docs.save(null);
      input.docs.emit({ projectId: null });
    },
    installed: () =>
      Object.entries(readRegistry(ws)).flatMap(([id, entry]) =>
        Object.values(entry.versions).map((v) => ({ id, title: entry.title, version: v.version, v })),
      ),
    revoke: (id, version, reason, at) => {
      updateRegistryVersion(ws, id, version, { revoked: { reason, at } });
      input.components.registry.revoke(id, version);
      input.components.events.record({
        projectId: "-",
        instanceId: "-",
        ref: `${id}@${version}`,
        kind: "market-revoked",
        code: "REVOKED",
      });
      input.components.usageChanged();
    },
  };
}
