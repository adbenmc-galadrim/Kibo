import type { RunView } from "@kibo/schema";
import type { Notice } from "../runs/notifier";

export type TurnEnd = { onTurnEnd(run: RunView): Promise<void> };

export function withDenialQuestions<L extends TurnEnd>(
  base: L,
  ask: (run: RunView) => string | null,
  log: (line: string) => void,
): L {
  return {
    ...base,
    async onTurnEnd(run: RunView) {
      try {
        await base.onTurnEnd(run);
      } finally {
        try {
          ask(run);
        } catch (e) {
          log(`denial question of run ${run.id} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    },
  };
}

export function denialNotice(run: Pick<RunView, "ticketKey" | "label">, count: number): Notice {
  const refused = count > 1 ? `${count} actions refusées` : "1 action refusée";
  return { title: `${run.ticketKey ?? run.label} : ${refused}`, body: "Kibo propose des règles" };
}
