import type { ProjectSnapshot, Worktree } from "@kibo/schema";
import type { ReactNode } from "react";

export type ChangesSlots = {
  workingAgent?: string | null;
  prOptions?: ReactNode;
  prRuleKey?: string | null;
};
export type ChangesSlotsHook = (
  project: ProjectSnapshot,
  worktree: string | null,
  ticketKey: string | null,
  worktrees: Worktree[],
) => ChangesSlots;

export const useNoSlots: ChangesSlotsHook = () => ({});
