import { isTerminal, type RunView } from "@kibo/schema";

export const activeRunOf = (runs: readonly RunView[], ticketId: string): RunView | null =>
  runs.find((r) => r.ticketId === ticketId && !isTerminal(r.state)) ?? null;
