import * as graph from "@kibo/component-graph";
import * as kanban from "@kibo/component-kanban";
import * as mockup from "@kibo/component-mockup";
import * as overview from "@kibo/component-overview";
import * as planning from "@kibo/component-planning";
import * as questions from "@kibo/component-questions";
import type { ComponentManifest, Instance, Page } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import {
  AppWindow,
  Blocks,
  CalendarRange,
  Frame,
  LayoutDashboard,
  type LucideIcon,
  MessageCircleQuestion,
  Network,
  SquareKanban,
} from "lucide-react";

export const BUILTIN_COMPONENTS: ComponentModule[] = [kanban, graph, mockup, questions, planning, overview];

const BUILTIN_ICONS: Record<string, LucideIcon> = {
  kanban: SquareKanban,
  graph: Network,
  mockup: Frame,
  questions: MessageCircleQuestion,
  planning: CalendarRange,
  overview: LayoutDashboard,
};

export const componentRef = (m: ComponentManifest): string => `${m.id}@${m.version}`;

export function findComponent(ref: string): ComponentModule | undefined {
  return BUILTIN_COMPONENTS.find((c) => componentRef(c.manifest) === ref);
}

export function findBuiltin(id: string): ComponentModule | undefined {
  return BUILTIN_COMPONENTS.find((c) => c.manifest.id === id);
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
