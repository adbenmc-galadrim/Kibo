import { KiboError, type KiboErrorCode, type ProjectCommand } from "@kibo/schema";
import { useCallback, useState } from "react";
import { client } from "../api";
import { frTicketEdit } from "../i18n/fr-ticket-edit";

export type TicketCommand = {
  run(command: ProjectCommand): Promise<boolean>;
  error: string | null;
  busy: boolean;
  clearError(): void;
};

const errorTexts: Partial<Record<KiboErrorCode, string>> = frTicketEdit.errors;

export const describeTicketError = (e: unknown): string =>
  e instanceof KiboError ? (errorTexts[e.code] ?? frTicketEdit.fallback) : frTicketEdit.fallback;

export function useTicketCommand(
  projectId: string,
  describe: (error: unknown) => string = describeTicketError,
): TicketCommand {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (command: ProjectCommand) => {
      setBusy(true);
      setError(null);
      try {
        await client.rpc({ method: "command", projectId, command });
        return true;
      } catch (e) {
        setError(describe(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [projectId, describe],
  );
  const clearError = useCallback(() => setError(null), []);
  return { run, error, busy, clearError };
}
