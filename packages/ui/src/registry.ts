import * as kanban from "@kibo/component-kanban";
import * as tickets from "@kibo/component-tickets";
import type { ComponentManifest, Instance, Page } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import { AppWindow, Blocks, LayoutDashboard, ListTree, type LucideIcon, SquareKanban } from "lucide-react";

export const BUILTIN_COMPONENTS: ComponentModule[] = [kanban, tickets];

const BUILTIN_ICONS: Record<string, LucideIcon> = { kanban: SquareKanban, tickets: ListTree };

export const componentRef = (m: ComponentManifest): string => `${m.id}@${m.version}`;

export function findComponent(ref: string): ComponentModule | undefined {
  return BUILTIN_COMPONENTS.find((c) => componentRef(c.manifest) === ref);
}

export function componentIcon(ref: string): LucideIcon {
  const id = findComponent(ref)?.manifest.id;
  return (id && BUILTIN_ICONS[id]) || Blocks;
}

export function pageIcon(page: Page, instances: Instance[]): LucideIcon {
  if (page.kind === "dashboard") return LayoutDashboard;
  const held = instances.find((i) => i.pageId === page.id);
  return held ? componentIcon(held.component) : AppWindow;
}
