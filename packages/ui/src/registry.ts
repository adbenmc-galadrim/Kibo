import * as graph from "@kibo/component-graph";
import * as kanban from "@kibo/component-kanban";
import * as notes from "@kibo/component-notes";
import * as tickets from "@kibo/component-tickets";
import type { ComponentManifest, Instance, Page } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import {
  AppWindow,
  Blocks,
  FileText,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  Network,
  SquareKanban,
} from "lucide-react";

export const BUILTIN_COMPONENTS: ComponentModule[] = [kanban, tickets, graph, notes];

const BUILTIN_ICONS: Record<string, LucideIcon> = {
  kanban: SquareKanban,
  tickets: ListTree,
  graph: Network,
  notes: FileText,
};

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
