import * as graph from "@kibo/component-graph";
import * as kanban from "@kibo/component-kanban";
import * as mcpSource from "@kibo/component-mcp-source";
import * as mockup from "@kibo/component-mockup";
import * as notes from "@kibo/component-notes";
import * as questions from "@kibo/component-questions";
import * as snake from "@kibo/component-snake";
import * as tickets from "@kibo/component-tickets";
import * as viewer3d from "@kibo/component-viewer-3d";
import type { ComponentManifest, Instance, Page } from "@kibo/schema";
import type { ComponentModule } from "@kibo/sdk";
import {
  AppWindow,
  Blocks,
  Box,
  FileText,
  Frame,
  Gamepad,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  MessageCircleQuestion,
  Network,
  Plug,
  SquareKanban,
} from "lucide-react";

export const BUILTIN_COMPONENTS: ComponentModule[] = [
  kanban,
  tickets,
  graph,
  notes,
  mcpSource,
  viewer3d,
  snake,
  mockup,
  questions,
];

const BUILTIN_ICONS: Record<string, LucideIcon> = {
  kanban: SquareKanban,
  tickets: ListTree,
  graph: Network,
  notes: FileText,
  "mcp-source": Plug,
  "viewer-3d": Box,
  snake: Gamepad,
  mockup: Frame,
  questions: MessageCircleQuestion,
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
