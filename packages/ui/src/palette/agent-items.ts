import { isInbox, type RunView } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { normalize, type PaletteItem } from "./palette-items";

const agentItem = (
  id: string,
  label: string,
  keywords: string,
  icon: PaletteItem["icon"],
  run: PaletteItem["run"],
): PaletteItem => ({
  id: `agent:${id}`,
  group: "agents",
  label,
  keywords: normalize(`${label} ${keywords}`),
  detail: null,
  statusId: null,
  color: null,
  icon,
  run,
  ticket: null,
});

export function agentItems(runs: RunView[], active: PaletteItem["ticket"]): PaletteItem[] {
  const replies = runs
    .filter((r) => r.state === "waiting_input")
    .map((r) =>
      agentItem(
        `reply:${r.id}`,
        fr.palette.reply(r.label, r.ticketKey ?? r.ticketTitle),
        r.ticketTitle,
        "reply",
        {
          kind: "action",
          action: { kind: "reply", runId: r.id },
        },
      ),
    );
  if (!active || isInbox(active.projectId)) return replies;
  const assign = agentItem(`assign:${active.ticketId}`, fr.palette.assign(active.keyLabel), "", "assign", {
    kind: "action",
    action: { kind: "assign", projectId: active.projectId, ticketId: active.ticketId },
  });
  return [...replies, assign];
}
