import type { AgentsState, RunView } from "@kibo/schema";
import type { AgentsPort } from "./agents-rpc";

export type FakeAgentsPort = AgentsPort & { change(run: RunView): void };

const HOST: AgentsState["host"] = {
  hostSlots: 1,
  cpuThreshold: 85,
  ramThreshold: 90,
  paused: false,
  autoSlots: 1,
  slotsFixed: false,
  cores: 8,
  ramGb: 16,
  used: 0,
  cpu: 0,
  ram: 0,
};

export function fakeAgentsPort(runs: RunView[]): FakeAgentsPort {
  const unused = () => {
    throw new Error("not used");
  };
  const listeners = new Set<(run: RunView) => void>();
  return {
    assign: unused,
    preview: unused,
    answer: unused,
    cancel: unused,
    move: unused,
    setPriority: unused,
    setHost: unused,
    log: unused,
    activeRuns: () => 0,
    onChange: () => () => {},
    onRunState(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state: () => ({
      runs,
      queue: [],
      host: HOST,
      tokensToday: 0,
      resumable: [],
      questions: [],
      projectAgents: [],
      progress: [],
      signals: [],
    }),
    change(run) {
      for (const listener of listeners) listener(run);
    },
  };
}
