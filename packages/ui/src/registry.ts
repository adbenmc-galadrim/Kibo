import * as kanban from "@kibo/component-kanban";
import * as tickets from "@kibo/component-tickets";
import type { ComponentManifest } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";

export const BUILTIN_COMPONENTS: ComponentModule[] = [kanban, tickets];

export const componentRef = (m: ComponentManifest): string => `${m.id}@${m.version}`;

export function findComponent(ref: string): ComponentModule | undefined {
  return BUILTIN_COMPONENTS.find((c) => componentRef(c.manifest) === ref);
}
