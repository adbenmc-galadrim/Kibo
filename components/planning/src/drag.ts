export const BACKLOG_ID = "planning:backlog";

type PlanDrop = { ticketId: string; sprintId: string | null };
type DropInput = {
  activeId: string;
  overId: string | null;
  cards: readonly { id: string; sprintId: string | null }[];
};

const columnSprintId = (columnId: string): string | null => (columnId === BACKLOG_ID ? null : columnId);

export function planDrop({ activeId, overId, cards }: DropInput): PlanDrop | null {
  const card = cards.find((c) => c.id === activeId);
  if (!card || overId === null) return null;
  const sprintId = columnSprintId(overId);
  return sprintId === card.sprintId ? null : { ticketId: card.id, sprintId };
}
