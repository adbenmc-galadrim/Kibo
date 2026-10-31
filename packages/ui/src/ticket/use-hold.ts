import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { useCallback } from "react";
import { frHold } from "../i18n/fr-hold";
import { useTicketCommand } from "./use-ticket-command";

type HoldCommand = {
  hold(reason: string): Promise<boolean>;
  resume(): Promise<boolean>;
  error: string | null;
  busy: boolean;
};

const errorTexts: Partial<Record<KiboErrorCode, string>> = frHold.errors;

const describeHoldError = (e: unknown): string =>
  e instanceof KiboError ? (errorTexts[e.code] ?? frHold.fallback) : frHold.fallback;

export function useHold(projectId: string, ticketId: string): HoldCommand {
  const { run, error, busy } = useTicketCommand(projectId, describeHoldError);
  const hold = useCallback((reason: string) => run({ method: "setHold", ticketId, reason }), [run, ticketId]);
  const resume = useCallback(() => run({ method: "setHold", ticketId, reason: null }), [run, ticketId]);
  return { hold, resume, error, busy };
}
