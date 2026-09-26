import type { ProjectSnapshot } from "@kibo/schema";
import type { ReactNode } from "react";

export type ChangesSlots = { commitBanner?: ReactNode; prOptions?: ReactNode; prRuleNote?: string | null };
export type ChangesSlotsHook = (
  project: ProjectSnapshot,
  worktree: string | null,
  ticketKey: string | null,
) => ChangesSlots;

export const useNoSlots: ChangesSlotsHook = () => ({});
