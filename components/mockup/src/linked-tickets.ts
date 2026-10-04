import { type DesignFrameKey, designFrameId, frameKeyOfRef, type TicketView } from "@kibo/schema";

export function linkedTickets(tickets: readonly TicketView[], key: DesignFrameKey): TicketView[] {
  const id = designFrameId(key);
  return tickets.filter((t) =>
    t.externalRefs.some((ref) => {
      const k = frameKeyOfRef(ref);
      return k !== null && designFrameId(k) === id;
    }),
  );
}
