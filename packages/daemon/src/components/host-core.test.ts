import { expect, test } from "bun:test";
import type { DaemonToBackend } from "@kibo/schema";
import { TEST_MANIFEST } from "./backend-code.test-helper";
import { type ChannelHandlers, createHost, type InvokeRequest } from "./host-core";

type Fake = { handlers: ChannelHandlers; sent: DaemonToBackend[] };

function fakeBackend(onSend: (fake: Fake, msg: DaemonToBackend) => void) {
  const opened: Fake[] = [];
  const open = async (handlers: ChannelHandlers) => {
    const fake: Fake = { handlers, sent: [] };
    opened.push(fake);
    return {
      send: (msg: DaemonToBackend) => {
        fake.sent.push(msg);
        onSend(fake, msg);
      },
      close: () => undefined,
    };
  };
  return { opened, open };
}

const ping: InvokeRequest = {
  projectId: "p",
  instanceId: "i",
  config: {},
  target: { action: "ping" },
  input: null,
};
const ready = { type: "ready", actions: ["ping"], jobs: [] };

test("crash backoff grows, then resets after a successful call", async () => {
  let clock = 0;
  const { opened, open } = fakeBackend((fake, msg) => {
    if (msg.type === "load") fake.handlers.message(ready);
    if (msg.type === "invoke" && opened.length < 3) fake.handlers.exit("boom");
    if (msg.type === "invoke" && opened.length >= 3)
      fake.handlers.message({ type: "result", id: msg.id, ok: true, result: 1 });
  });
  const host = createHost(
    {
      ref: "probe@0.1.0",
      manifest: TEST_MANIFEST,
      code: { server: null, migrations: null },
      onCall: async () => null,
      now: () => clock,
      backoffMs: [1_000, 5_000],
      log: () => undefined,
    },
    open,
    false,
  );
  await expect(host.invoke(ping)).rejects.toThrow("COMPONENT_CRASHED");
  clock = 999;
  await expect(host.invoke(ping)).rejects.toThrow("restarting");
  clock = 1_000;
  await expect(host.invoke(ping)).rejects.toThrow("COMPONENT_CRASHED");
  clock = 5_999;
  await expect(host.invoke(ping)).rejects.toThrow("restarting");
  clock = 6_000;
  expect(await host.invoke(ping)).toBe(1);
  expect(opened).toHaveLength(3);
  host.stop();
});

test("a backend that never says ready times out and is stopped", async () => {
  const lines: string[] = [];
  const { open } = fakeBackend((fake, msg) => {
    if (msg.type === "load") fake.handlers.message({ type: "bogus" });
  });
  const host = createHost(
    {
      ref: "probe@0.1.0",
      manifest: TEST_MANIFEST,
      code: { server: null, migrations: null },
      onCall: async () => null,
      readyTimeoutMs: 50,
      backoffMs: [0],
      log: (l) => lines.push(l),
    },
    open,
    true,
  );
  await expect(host.describe()).rejects.toThrow("TIMEOUT");
  expect(host.running).toBe(false);
  expect(lines.some((l) => l.startsWith("invalid backend message"))).toBe(true);
});
