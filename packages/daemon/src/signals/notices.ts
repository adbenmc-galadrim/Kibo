import type { RunView, Signal } from "@kibo/schema";
import type { Notice } from "../agents/notifier";

export function blockerNotice(
  run: Pick<RunView, "label">,
  signal: Pick<Signal, "ticketKey" | "title">,
): Notice {
  return { title: `Blocage signalé par ${run.label}`, body: `${signal.ticketKey} · ${signal.title}` };
}
