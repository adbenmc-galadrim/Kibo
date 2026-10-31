import type { PrPoller } from "../code/pr-poller";
import type { Env } from "../code/run";
import type { Service } from "../service";
import { observeBranches } from "./branch-observer";
import { type Log, readBranches } from "./refs-reader";

export type Delay = (fn: () => void, ms: number) => () => void;
type TrackingDeps = {
  service: Service;
  poller: Pick<PrPoller, "beforePoll">;
  refsChanged(listener: (projectId: string) => void): () => void;
  log: Log;
  env?: Env;
  refs?: (folder: string) => Promise<string[]>;
  delay?: Delay;
};
export type Tracking = { observe(): Promise<void>; idle(): Promise<void>; stop(): void };

const REFS_GROUPING_MS = 500;

const timeout: Delay = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

export function startTracking(deps: TrackingDeps): Tracking {
  const delay = deps.delay ?? timeout;
  const refs = deps.refs ?? ((folder: string) => readBranches(folder, deps.env ?? {}, deps.log));
  const state = new Map<string, string>();
  let stopped = false;
  let chain: Promise<void> = Promise.resolve();
  let cancelPending: (() => void) | null = null;

  const pass = async () => {
    if (!stopped) await observeBranches({ service: deps.service, refs, log: deps.log }, state);
  };
  const observe = (): Promise<void> => {
    chain = chain.then(pass, pass);
    return chain;
  };
  const schedule = () => {
    cancelPending?.();
    cancelPending = delay(() => {
      cancelPending = null;
      void observe().catch(deps.log("branch observation failed"));
    }, REFS_GROUPING_MS);
  };

  const removePass = deps.poller.beforePoll(observe);
  const unlisten = deps.refsChanged(schedule);
  return {
    observe,
    idle: () => chain,
    stop() {
      stopped = true;
      cancelPending?.();
      cancelPending = null;
      removePass();
      unlisten();
    },
  };
}
