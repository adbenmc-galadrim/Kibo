import type { AgentsState, FileRef, RunView } from "@kibo/schema";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { useAgents, useDaemonOnline, useNow, useRunLog } from "../state/use-agents";
import { AgentBar } from "./AgentBar";
import { AgentDrawer } from "./AgentDrawer";

type Props = {
  onLaunch: () => void;
  focusRunId: string | null;
  onFocused: () => void;
  onOpenFile: (ref: FileRef) => void;
};

export function pickRun(state: AgentsState, picked: string | null): RunView | null {
  return (
    state.runs.find((r) => r.id === picked) ??
    state.runs.find((r) => r.state === "waiting_input") ??
    state.runs.find((r) => r.state === "running") ??
    null
  );
}

export function AgentPanel({ onLaunch, focusRunId, onFocused, onOpenFile }: Props) {
  const state = useAgents();
  const now = useNow();
  const online = useDaemonOnline();
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (!focusRunId) return;
    setPicked(focusRunId);
    setExpanded(true);
    onFocused();
  }, [focusRunId, onFocused]);
  const selected = state ? pickRun(state, picked) : null;
  const log = useRunLog(expanded ? (selected?.id ?? null) : null);
  if (!state) return null;
  const open = (runId: string) => {
    setPicked(runId);
    setExpanded(true);
  };
  return (
    <section aria-label={fr.agents.bar} className="shrink-0 border-t bg-background">
      {expanded ? (
        <AgentDrawer
          state={state}
          now={now}
          selected={selected}
          log={log}
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
          onExpand={() => setExpanded(true)}
          onSelect={open}
        />
      )}
    </section>
  );
}
