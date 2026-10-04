import { expect, test } from "bun:test";
import { demoAgentBin } from "./agent-bin";

test("in a compiled binary the demo agent sits next to the executable", () => {
  expect(demoAgentBin("/Applications/Kibo.app/Contents/MacOS/kibo-daemon", "/$bunfs/root/demo")).toBe(
    "/Applications/Kibo.app/Contents/MacOS/kibo-demo-agent",
  );
});

test("in development the demo agent is the fake claude script", () => {
  expect(demoAgentBin("/usr/local/bin/bun", "/repo/packages/daemon/src/demo")).toBe(
    "/repo/packages/daemon/src/agents/fake-claude.ts",
  );
});
