import { executeProjectCommand, listTickets } from "@kibo/core";
import { evaluateRules, type RuleTrigger, readRules } from "@kibo/core/rules";
import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { type CommandEvent, type CommandInterceptor, type CommandMeta, USER_COMMAND } from "./docs";
import type { Store } from "./store";

export type CommandHub = {
  onCommand(listener: (e: CommandEvent) => void): () => void;
  intercept(interceptor: CommandInterceptor): () => void;
};

export type CommandPath = {
  run(projectId: string, command: ProjectCommand, meta?: CommandMeta): unknown;
  trigger(projectId: string, trigger: RuleTrigger): number;
  transaction<T>(fn: () => T): T;
  commands: CommandHub;
};

export type CommandPathDeps = {
  store: Store;
  project(id: string): LoroDoc;
  assertWritable(projectId: string): void;
  save(projectId: string): void;
  restore(projectId: string): void;
  emit(message: ChangeMessage): void;
  published(projectId: string, done: CommandEvent[]): void;
};

type Work<T> = (doc: LoroDoc, done: CommandEvent[]) => T;

export function createCommandPath(deps: CommandPathDeps): CommandPath {
  const listeners = new Set<(e: CommandEvent) => void>();
  const interceptors = new Set<CommandInterceptor>();
  let touched: Set<string> | null = null;

  const execute = (
    doc: LoroDoc,
    projectId: string,
    requested: ProjectCommand,
    meta: CommandMeta,
    done: CommandEvent[],
  ) => {
    let command = requested;
    for (const i of interceptors) command = i(projectId, command, meta);
    const result = executeProjectCommand(doc, command);
    done.push({ projectId, command, result, meta });
    return { command, result };
  };
  const derive = (doc: LoroDoc, projectId: string, trigger: RuleTrigger, done: CommandEvent[]) => {
    for (const command of evaluateRules(readRules(doc), trigger, listTickets(doc)))
      execute(doc, projectId, command, USER_COMMAND, done);
  };
  const restoreAll = (error: unknown, projectIds: Iterable<string>): never => {
    try {
      for (const id of projectIds) deps.restore(id);
    } catch (failure) {
      throw new AggregateError([error, failure], "restoring projects after a failed command failed");
    }
    throw error;
  };
  const rollback = (error: unknown, projectIds: Set<string>): never => {
    try {
      return restoreAll(error, projectIds);
    } finally {
      for (const id of projectIds) deps.emit({ projectId: id });
    }
  };
  const persist = (projectId: string, done: CommandEvent[]) => {
    deps.store.transaction(() => {
      deps.save(projectId);
      for (const e of done) for (const l of listeners) l(e);
    });
  };
  const guarded = <T>(projectId: string, work: Work<T>): T => {
    deps.assertWritable(projectId);
    const done: CommandEvent[] = [];
    let out: T;
    try {
      out = work(deps.project(projectId), done);
      if (done.length > 0) persist(projectId, done);
    } catch (e) {
      if (done.length > 0) restoreAll(e, [projectId]);
      throw e;
    }
    if (done.length === 0) return out;
    touched?.add(projectId);
    deps.published(projectId, done);
    return out;
  };

  return {
    run(projectId, requested, meta = USER_COMMAND) {
      return guarded(projectId, (doc, done) => {
        const { command, result } = execute(doc, projectId, requested, meta, done);
        if (command.method === "setStatus")
          derive(doc, projectId, { kind: "status_changed", ticketId: command.ticketId }, done);
        return result;
      });
    },
    trigger(projectId, trigger) {
      return guarded(projectId, (doc, done) => {
        derive(doc, projectId, trigger, done);
        return done.length;
      });
    },
    transaction<T>(fn: () => T): T {
      const parent = touched;
      const mine = new Set<string>();
      touched = mine;
      let out: T;
      try {
        out = deps.store.transaction(fn);
      } catch (e) {
        touched = parent;
        return rollback(e, mine);
      } finally {
        touched = parent;
      }
      for (const id of mine) parent?.add(id);
      return out;
    },
    commands: {
      onCommand(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      intercept(interceptor) {
        interceptors.add(interceptor);
        return () => interceptors.delete(interceptor);
      },
    },
  };
}
