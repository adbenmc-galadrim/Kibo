import type { StatusId, TicketView } from "@kibo/schema";
import type { KiboSdk } from "@kibo/sdk";
import { useState } from "react";
import { commitDrop, type Drop, nextOrder } from "./drop";
import { fr } from "./fr";
import type { useColumnOrder } from "./use-column-order";

type Placed = Parameters<typeof nextOrder>[1];

export function useCardMoves(sdk: KiboSdk, columnOrder: ReturnType<typeof useColumnOrder>, placed: Placed) {
  const [error, setError] = useState<string | null>(null);
  const setStatus = async (t: TicketView, statusId: StatusId, reason?: string): Promise<boolean> => {
    try {
      await sdk.run({ method: "setStatus", ticketId: t.id, statusId, reason });
      setError(null);
      return true;
    } catch {
      setError(fr.moveFailed(t.keyLabel));
      return false;
    }
  };
  const place = async (t: TicketView, drop: Drop, reason?: string): Promise<boolean> => {
    const done = await columnOrder.write(nextOrder(columnOrder.order, placed, drop), () =>
      commitDrop(sdk, placed, drop, reason),
    );
    setError(done ? null : fr.moveFailed(t.keyLabel));
    return done;
  };
  return { error, setStatus, place };
}
