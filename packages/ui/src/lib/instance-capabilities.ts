import {
  type Capability,
  type ComponentManifest,
  type ComponentSummary,
  type Instance,
  splitRef,
} from "@kibo/schema";
import type { FocusApi, SelectionApi, VisibilityApi } from "@kibo/sdk";
import { findComponent } from "../registry";

export type InstanceApis = {
  capabilities: readonly Capability[];
  focus: FocusApi;
  visibility: VisibilityApi;
  selection: SelectionApi;
};

export function manifestOf(
  instance: Instance,
  components: ComponentSummary[] | null,
): ComponentManifest | null {
  const builtin = findComponent(instance.component);
  if (builtin) return builtin.manifest;
  const { id, version } = splitRef(instance.component);
  const v = components?.find((c) => c.id === id && !c.builtin)?.versions.find((x) => x.version === version);
  return v?.active && v.manifest ? v.manifest : null;
}

export const instanceCapabilities = (
  instance: Instance,
  components: ComponentSummary[] | null,
): Capability[] => [...(manifestOf(instance, components)?.capabilities ?? [])];

export const instanceSelects = (instance: Instance, components: ComponentSummary[] | null): boolean =>
  manifestOf(instance, components)?.selection ?? false;
