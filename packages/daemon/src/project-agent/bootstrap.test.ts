import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChangeMessage } from "@kibo/schema";
import type { Orchestrator } from "../agents/orchestrator";
import { startProjectAgent } from "./bootstrap";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("the project agent attaches its summaries to the service and detaches on stop", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-pa-boot-"));
  dirs.push(home);
  const attached: string[] = [];
  const emitted: ChangeMessage[] = [];
  const boot = startProjectAgent({
    home,
    service: {
      docs: { emit: (m: ChangeMessage) => emitted.push(m) },
      deliverAnswers: () => ({ sent: 0, runId: null }),
      attachProjectAgent(port) {
        attached.push(`attach:${port.summaries().length}`);
        return () => attached.push("detach");
      },
    },
    orchestrator: (): Orchestrator => {
      throw new Error("no orchestrator in this test");
    },
    notify: () => {},
  });
  expect(() => boot.agent.view("p1")).toThrow("the project agent is not available yet");
  boot.stop();
  expect(attached).toEqual(["attach:0", "detach"]);
  expect(emitted).toEqual([]);
});
