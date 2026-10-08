import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookPayload } from "@kibo/schema";
import { createHookSink } from "./hook-sink";
import { openRunRegistry } from "./run-registry";
import { openRunStore } from "./run-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const write: HookPayload = {
  event: "PreToolUse",
  sessionId: "s",
  transcriptPath: null,
  tool: "Write",
  detail: null,
  question: null,
  agentId: null,
  ask: null,
};

test("a demo guard that cannot be built denies the call and is logged", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-sink-"));
  dirs.push(home);
  const store = openRunStore(home);
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const registry = openRunRegistry(store);
    registry.create(
      {
        id: "r1",
        projectId: "p1",
        ticketId: "t1",
        ticketKey: "DEMO-6",
        ticketTitle: "Démo",
        profileId: "demo",
        profileName: "demo",
        sessionId: "s",
        brief: "",
        resumedFrom: null,
      },
      0,
    );
    registry.apply("r1", { type: "admitted", lane: 1 });
    const gone = join(home, "runs/r1/workspace");
    registry.apply("r1", {
      type: "spawned",
      pid: 1,
      resume: false,
      workspace: "isolated",
      cwd: gone,
      guidelines: 0,
    });
    const sink = createHookSink({ live: new Map(), tasks: new Map(), registry });
    expect(sink.receive("r1", write, { file_path: join(gone, "notes.md") })).toEqual({
      decision: "deny",
      reason: "guard error",
    });
    expect(errors.mock.calls.some((c) => String(c[0]).includes("guard of run r1 failed"))).toBe(true);
  } finally {
    errors.mockRestore();
    store.close();
  }
});
