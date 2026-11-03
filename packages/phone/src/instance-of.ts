import { type ComponentManifest, configDefaults, type ProjectSnapshot, splitRef } from "@kibo/schema";

type PhoneInstance = { id: string; config: Record<string, unknown> };

export function instanceFor(
  snapshot: Pick<ProjectSnapshot, "instances">,
  manifest: ComponentManifest,
): PhoneInstance {
  const found = snapshot.instances.find((i) => splitRef(i.component).id === manifest.id);
  if (found) return { id: found.id, config: found.config };
  return { id: `phone:${manifest.id}`, config: configDefaults(manifest.configSchema) };
}
