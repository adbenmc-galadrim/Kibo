import type { Database } from "bun:sqlite";
import type { ChangeMessage, ProjectEventSink, TicketSession, TicketView } from "@kibo/schema";
import { createGit, type Env } from "../code/run";
import type { RpcExtension } from "../rpc-extensions";
import { call, type Service } from "../service";
import { sessionRpc } from "./session-rpc";
import { createSessionStore } from "./session-store";
import { createSessionSweep } from "./session-sweep";

type TicketSessionsInput = {
  db: Database;
  service: Service;
  clock: { now(): number };
  sink?: ProjectEventSink;
  emit(message: ChangeMessage): void;
  env?: Env;
};

type TicketSessions = {
  rpc: RpcExtension;
  pass(): void;
  activity(projectId: string): ReadonlyMap<string, TicketSession>;
};

const consoleLog = (what: string) => (e: unknown) => console.error(`[kibo-daemon] ${what} failed`, e);

async function currentBranch(cwd: string, env: Env = {}): Promise<string | null> {
  try {
    const result = await createGit(cwd, env).run(["rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = result.stdout.trim();
    return result.code === 0 && branch !== "" && branch !== "HEAD" ? branch : null;
  } catch (e) {
    consoleLog(`reading the branch of ${cwd}`)(e);
    return null;
  }
}

export function startTicketSessions(input: TicketSessionsInput): TicketSessions {
  const store = createSessionStore(input.db);
  const now = () => input.clock.now();
  const tickets = (projectId: string): TicketView[] =>
    call(input.service, { method: "getProject", projectId }).tickets;
  const emit = (projectId: string) => input.emit({ projectId });
  const sweep = createSessionSweep({
    store,
    tickets,
    now,
    ...(input.sink && { sink: input.sink }),
    emit,
    log: consoleLog,
  });
  return {
    rpc: sessionRpc({
      store,
      tickets,
      branchAt: (cwd) => currentBranch(cwd, input.env),
      now,
      sweep: sweep.pass,
      ...(input.sink && { sink: input.sink }),
      emit,
    }),
    pass: sweep.pass,
    activity: (projectId) => store.active(projectId, now()),
  };
}
