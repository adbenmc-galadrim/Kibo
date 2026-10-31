import type { Capability, ComponentManifest, Instance } from "@kibo/schema";
import type { FocusApi, SelectionApi, SpotlightApi, VisibilityApi } from "@kibo/sdk";
import { findComponent } from "../registry";

export type InstanceApis = {
  capabilities: readonly Capability[];
  focus: FocusApi;
  visibility: VisibilityApi;
  selection: SelectionApi;
  spotlight?: SpotlightApi;
};

export function manifestOf(instance: Pick<Instance, "component">): ComponentManifest | null {
  return findComponent(instance.component)?.manifest ?? null;
}

export const NONE: readonly Capability[] = [];
