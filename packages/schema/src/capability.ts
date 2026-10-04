import { z } from "zod";
import type { ComponentKind } from "./manifest";

export const CAPABILITIES = ["webgl", "audio", "fullscreen", "gamepad", "assets", "design"] as const;
export const Capability = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof Capability>;

const PREFIX = "cap:";

export const capPermission = (c: Capability): string => `${PREFIX}${c}`;

export function capabilityOfPermission(entry: string): Capability | null {
  if (!entry.startsWith(PREFIX)) return null;
  const parsed = Capability.safeParse(entry.slice(PREFIX.length));
  return parsed.success ? parsed.data : null;
}

type CapabilityFields = { capabilities?: readonly Capability[] | undefined };

export const capabilitiesOf = (m: CapabilityFields): Capability[] => [...(m.capabilities ?? [])];

export function capabilityIssue(m: CapabilityFields & { kind: ComponentKind }): string | null {
  const declared = m.capabilities ?? [];
  if (new Set(declared).size !== declared.length) return "INVALID_MANIFEST: capabilities must be unique";
  if (m.kind === "adapter" && declared.length > 0) return "INVALID_MANIFEST: an adapter has no capability";
  return null;
}

export const Selection = z
  .object({ kind: z.literal("ticket"), ids: z.array(z.string().min(1)).min(1).max(200) })
  .refine((s) => new Set(s.ids).size === s.ids.length, "duplicate ids");
export type Selection = z.infer<typeof Selection>;
