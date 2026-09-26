import { type AgentsState, type RunState, type RunView, runSubject } from "@kibo/schema";
import { useEffect, useRef } from "react";
import { fr } from "../i18n/fr";
import { errorText } from "./format";

export type RunNotice = { title: string; body: string };

export function runNotices(previous: Map<string, RunState>, runs: RunView[]): RunNotice[] {
  return runs.flatMap((r): RunNotice[] => {
    const before = previous.get(r.id);
    if (before === undefined || before === r.state) return [];
    if (r.state === "waiting_input")
      return [{ title: fr.notify.waiting(r.label), body: runSubject(r, r.question ?? "") }];
    if (r.state === "done") return [{ title: fr.notify.done(r.label), body: runSubject(r) }];
    if (r.state === "failed")
      return [{ title: fr.notify.failed(r.label), body: runSubject(r, errorText(r.error)) }];
    return [];
  });
}

export function useRunNotifications(state: AgentsState | null, enabled: boolean): void {
  const previous = useRef<Map<string, RunState> | null>(null);
  useEffect(() => {
    if (!state) return;
    const before = previous.current;
    previous.current = new Map(state.runs.map((r) => [r.id, r.state]));
    if (!before || !enabled || typeof Notification === "undefined" || Notification.permission !== "granted")
      return;
    for (const notice of runNotices(before, state.runs)) {
      const shown = new Notification(notice.title, { body: notice.body });
      shown.onclick = () => window.focus();
    }
  }, [state, enabled]);
}
