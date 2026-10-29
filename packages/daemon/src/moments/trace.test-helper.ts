import { afterEach } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initRun } from "@kibo/core/run-machine";
import type { HookPayload, RunAction, RunMomentsEvent, RunView } from "@kibo/schema";
import { openTranscript, structuredPatch } from "../runs/fake-claude-transcript";
import { type MomentStore, openMomentStore } from "./store";
import type { SubagentPort } from "./trace-live";
import { createTraceService } from "./trace-service";
import { readTranscriptSlice } from "./transcript-reader";

const dirs: string[] = [];

export const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "kibo-trace-")));
  dirs.push(d);
  return d;
};

export const cleanTraceDirs = () =>
  afterEach(() => {
    for (const d of dirs.splice(0)) {
      chmodSync(d, 0o700);
      rmSync(d, { recursive: true, force: true });
    }
  });

export const SESSION = "sess-1";

export const hook = (event: HookPayload["event"], p: Partial<HookPayload> = {}): HookPayload => ({
  event,
  sessionId: SESSION,
  transcriptPath: null,
  tool: null,
  detail: null,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
  ...p,
});

export type SetupOptions = {
  maxBytes?: number;
  transcriptPath?: string;
  wrapStore?: (store: MomentStore) => MomentStore;
  onActions?: (runId: string, actions: readonly RunAction[], at: number) => void;
  subagents?: SubagentPort;
  onRead?: (path: string) => void;
};

export function setup(options: SetupOptions = {}) {
  const home = tmp();
  const root = join(home, "projects");
  mkdirSync(join(root, "proj"), { recursive: true });
  const path = join(root, "proj", `${SESSION}.jsonl`);
  const store = openMomentStore(home);
  const events: RunMomentsEvent[] = [];
  const clock = { now: 5_000 };
  const reads = { count: 0 };
  const trace = createTraceService({
    store: options.wrapStore?.(store) ?? store,
    ...(options.maxBytes !== undefined && { passBytes: options.maxBytes }),
    root,
    now: () => clock.now,
    emit: (e) => events.push(e),
    ...(options.onActions !== undefined && { onActions: options.onActions }),
    ...(options.subagents !== undefined && { subagents: options.subagents }),
    read: (p, offset) => {
      reads.count += 1;
      options.onRead?.(p);
      return readTranscriptSlice(p, offset, options.maxBytes);
    },
  });
  const record = {
    id: "run-1",
    kind: "ticket" as const,
    seq: 1,
    projectId: "p1",
    ticketId: "t1",
    ticketKey: "KIB-14",
    ticketTitle: "Corriger la validation",
    profileId: "global:opus",
    profileName: "opus-dev",
    agentScope: "global" as const,
    projectKey: null,
    sessionId: SESSION,
    brief: "",
    createdAt: 0,
    resumedFrom: null,
  };
  const run: RunView = {
    ...initRun(record, 0, 0),
    state: "running",
    transcriptPath: options.transcriptPath ?? path,
  };
  const transcript = openTranscript(path, SESSION, home);
  transcript.user("Corrige KIB-14.");
  return { home, root, path, store, events, clock, reads, trace, run, transcript };
}

export type Setup = ReturnType<typeof setup>;

export function playEditAndTests(s: Setup) {
  const t = s.transcript;
  t.say("Je commence par lire le formulaire.");
  t.toolResult(t.toolUse("Read", { file_path: "src/LoginForm.tsx" }), {
    content: "export {}",
    isError: false,
  });
  const edit = t.toolUse("Edit", { file_path: "src/LoginForm.tsx" });
  t.toolResult(edit, {
    content: "ok",
    isError: false,
    toolUseResult: {
      filePath: "src/LoginForm.tsx",
      structuredPatch: structuredPatch({ added: 2, removed: 1 }),
    },
  });
  t.toolResult(t.toolUse("Bash", { command: "bun test" }), {
    content: "Exit code 1\n 12 pass\n 1 fail",
    isError: true,
  });
  t.think("La validation vide échoue.");
  t.say("Il reste un test rouge.");
}

export const kinds = (s: Setup) => s.store.list(s.run.id).map((m) => m.data.kind);
