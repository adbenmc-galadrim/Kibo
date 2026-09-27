import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectDoc, executeProjectCommand, readProject } from "@kibo/core";
import {
  type CommandResult,
  type IntegrationEvent,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
} from "@kibo/schema";
import type { CommandEvent, CommandInterceptor, CommandMeta } from "../../docs";
import { migrateIntegrations } from "../db";
import type { IntegrationHost, SystemNotification } from "../types";

export type FakeHost = IntegrationHost & {
  projectId: string;
  notifications: SystemNotification[];
  events: IntegrationEvent[];
  remoteUrl: string | null;
  clock: { now: number };
  ghCalls: string[][];
  ghReply: { code: number; stdout: string; stderr: string };
  close(): void;
};

export function createFakeHost(opts: { user?: string } = {}): FakeHost {
  const home = mkdtempSync(join(tmpdir(), "kibo-int-"));
  const db = new Database(join(home, "kibo.db"), { create: true, strict: true });
  migrateIntegrations(db);
  const meta: ProjectMeta = { id: "p1", key: "KIB", name: "Kibo", folder: "/tmp/kibo", color: "#71717A" };
  const doc = createProjectDoc(meta);
  const listeners = new Set<(e: CommandEvent) => void>();
  const interceptors = new Set<CommandInterceptor>();
  const ensureProject = (projectId: string) => {
    if (projectId !== meta.id) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
  };
  const host: FakeHost = {
    user: opts.user ?? "adam",
    identity: () => opts.user ?? "adam",
    home,
    db,
    projectId: meta.id,
    notifications: [],
    events: [],
    remoteUrl: "git@github.com:adam/kibo.git",
    clock: { now: Date.parse("2026-09-26T10:00:00Z") },
    ghCalls: [],
    ghReply: { code: 1, stdout: "", stderr: "not logged in" },
    transaction: (fn) => db.transaction(fn)(),
    projects: () => [meta],
    snapshot(projectId) {
      ensureProject(projectId);
      return readProject(doc);
    },
    command<C extends ProjectCommand>(projectId: string, cmd: C, m: CommandMeta): CommandResult[C["method"]] {
      ensureProject(projectId);
      let command: ProjectCommand = cmd;
      for (const i of interceptors) command = i(projectId, command, m);
      const result = executeProjectCommand(doc, command);
      db.transaction(() => {
        for (const l of listeners) l({ projectId, command, result, meta: m });
      })();
      return result as CommandResult[C["method"]];
    },
    onCommand(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    intercept(i) {
      interceptors.add(i);
      return () => interceptors.delete(i);
    },
    broadcast: (e) => host.events.push(e),
    notify: (n) => {
      host.notifications.push(n);
      host.events.push({ type: "notice", title: n.title, body: n.body });
    },
    gitRemoteUrl: async () => host.remoteUrl,
    gitAvailable: async () => true,
    gh: async (args) => {
      host.ghCalls.push(args);
      return host.ghReply;
    },
    now: () => host.clock.now,
    close() {
      db.close();
      rmSync(home, { recursive: true, force: true });
    },
  };
  return host;
}
