import { agentItems } from "./agent-items";
import {
  activeTicket,
  buildItems,
  FILTERS,
  type PaletteContext,
  type PaletteFilter,
  type PaletteItem,
} from "./palette-items";

export const paletteItems = (ctx: PaletteContext): PaletteItem[] => [
  ...buildItems(ctx),
  ...(ctx.executionShown ? agentItems(ctx.agents?.runs ?? [], activeTicket(ctx)) : []),
];

export const paletteFilters = (executionShown: boolean): PaletteFilter[] =>
  executionShown ? FILTERS : FILTERS.filter((f) => f !== "agents");
