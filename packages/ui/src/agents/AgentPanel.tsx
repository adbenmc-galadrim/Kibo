import type { AgentsState, FileRef, RunView } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { AgentDock } from "../shell/lazy-screens";
import { SyncIndicator } from "../shell/SyncIndicator";
import { useAgents, useDaemonOnline, useNow } from "../state/use-agents";
import { AgentBar } from "./AgentBar";
import { readSessionPref, writeSessionPref } from "./session-pref";

type Props = {
  onLaunch: () => void;
  focusRunId: string | null;
  onFocused: () => void;
  onOpenFile: (ref: FileRef) => void;
};

export const DOCK_OPEN_KEY = "kibo.agents.dock.open";

export function pickRun(state: AgentsState, picked: string | null): RunView | null {
  return (
    state.runs.find((r) => r.id === picked) ??
    state.runs.find((r) => r.state === "waiting_input") ??
    state.runs.find((r) => r.state === "running") ??
    null
  );
}

function useDockOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => readSessionPref(DOCK_OPEN_KEY) === "1");
  const set = useCallback((next: boolean) => {
    writeSessionPref(DOCK_OPEN_KEY, next ? "1" : null);
    setOpen(next);
  }, []);
  return [open, set];
}

export function AgentPanel({ onLaunch, focusRunId, onFocused, onOpenFile }: Props) {
  const state = useAgents();
  const now = useNow();
  const online = useDaemonOnline();
  const [expanded, setExpanded] = useDockOpen();
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (!focusRunId) return;
    setPicked(focusRunId);
    setExpanded(true);
    onFocused();
  }, [focusRunId, onFocused, setExpanded]);
  if (!state) return null;
  const open = (runId: string) => {
    setPicked(runId);
    setExpanded(true);
  };
  return (
    <section aria-label={fr.agents.bar} className="shrink-0 border-t bg-background">
      {expanded ? (
        <AgentDock
          state={state}
          now={now}
          online={online}
          selected={pickRun(state, picked)}
          onSelect={setPicked}
          onCollapse={() => setExpanded(false)}
          onLaunch={onLaunch}
          onOpenFile={onOpenFile}
        />
      ) : (
        <AgentBar
          state={state}
          now={now}
          online={online}
          indicator={<SyncIndicator online={online} />}
          expanded={false}
          onToggle={() => setExpanded(true)}
          onSelect={open}
        />
      )}
    </section>
  );
}
