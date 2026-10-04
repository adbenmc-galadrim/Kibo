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
  instance: Pick<Instance, "component">,
  components: ComponentSummary[] | null,
): ComponentManifest | null {
  const builtin = findComponent(instance.component);
  if (builtin) return builtin.manifest;
  const { id, version } = splitRef(instance.component);
  const v = components?.find((c) => c.id === id && !c.builtin)?.versions.find((x) => x.version === version);
  return v?.active && v.manifest ? v.manifest : null;
}

const NONE: readonly Capability[] = [];

export const instanceCapabilities = (
  instance: Pick<Instance, "component">,
  components: ComponentSummary[] | null,
): readonly Capability[] => manifestOf(instance, components)?.capabilities ?? NONE;

export const instanceSelects = (
  instance: Pick<Instance, "component">,
  components: ComponentSummary[] | null,
): boolean => manifestOf(instance, components)?.selection ?? false;
