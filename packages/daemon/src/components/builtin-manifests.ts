import { ComponentManifest, splitRef } from "@kibo/schema";
import manifests from "./builtin-manifests.json";

export const BUILTIN_MANIFESTS: readonly ComponentManifest[] = ComponentManifest.array().parse(manifests);

export function builtinManifestOf(ref: string): ComponentManifest | null {
  const { id, version } = splitRef(ref);
  return BUILTIN_MANIFESTS.find((m) => m.id === id && m.version === version) ?? null;
}
