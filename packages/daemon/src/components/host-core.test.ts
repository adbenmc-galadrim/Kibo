import { expect, test } from "bun:test";
import type { DaemonToBackend } from "@kibo/schema";
import { TEST_MANIFEST } from "./backend-code.test-helper";
import { type ChannelHandlers, createHost, type HostOptions, type InvokeRequest } from "./host-core";

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

function hostWith(onSend: (fake: Fake, msg: DaemonToBackend) => void, extra: Partial<HostOptions> = {}) {
  const lines: string[] = [];
  const backend = fakeBackend(onSend);
  const host = createHost(
    {
      ref: "probe@0.1.0",
      manifest: TEST_MANIFEST,
      code: { server: null, migrations: null },
      onCall: async () => null,
      readyTimeoutMs: 50,
      backoffMs: [60_000],
      log: (l) => lines.push(l),
      ...extra,
    },
    backend.open,
    true,
  );
  return { host, lines, opened: backend.opened };
}

test("a message outside the protocol stops the backend as a crash", async () => {
  const { host, lines } = hostWith((fake, msg) => {
    if (msg.type === "load") fake.handlers.message({ type: "bogus" });
  });
  await expect(host.describe()).rejects.toThrow("COMPONENT_CRASHED");
  expect(host.running).toBe(false);
  expect(lines.some((l) => l.includes("protocol violation"))).toBe(true);
  await expect(host.invoke(ping)).rejects.toThrow("restarting");
});

test("an unexpected ready message is a protocol violation", async () => {
  const { host } = hostWith((fake, msg) => {
    if (msg.type === "load" || msg.type === "invoke") fake.handlers.message(ready);
  });
  await expect(host.invoke(ping)).rejects.toThrow("COMPONENT_CRASHED");
  expect(host.running).toBe(false);
});

test("a result for an unknown invocation is a protocol violation", async () => {
  const { host } = hostWith((fake, msg) => {
    if (msg.type === "load") fake.handlers.message(ready);
    if (msg.type === "invoke") fake.handlers.message({ type: "result", id: msg.id + 1, ok: true, result: 1 });
  });
  await expect(host.invoke(ping)).rejects.toThrow("COMPONENT_CRASHED");
  expect(host.running).toBe(false);
});

test("a backend that never says ready times out and is stopped", async () => {
  const { host } = hostWith(() => undefined);
  await expect(host.describe()).rejects.toThrow("TIMEOUT");
  expect(host.running).toBe(false);
});

test("error codes a backend may not choose become INTERNAL", async () => {
  const { host } = hostWith((fake, msg) => {
    if (msg.type === "load") fake.handlers.message(ready);
    if (msg.type === "invoke") {
      const code = msg.input === "trust" ? "UNAUTHORIZED" : "NOT_FOUND";
      fake.handlers.message({ type: "result", id: msg.id, ok: false, error: { code, message: "x" } });
    }
  });
  await expect(host.invoke({ ...ping, input: "trust" })).rejects.toMatchObject({
    code: "INTERNAL",
    message: expect.stringContaining("UNAUTHORIZED"),
  });
  await expect(host.invoke(ping)).rejects.toMatchObject({ code: "NOT_FOUND" });
  host.stop();
});

test("waiting for a free slot is bounded by timeoutMs", async () => {
  const { host } = hostWith(
    (fake, msg) => {
      if (msg.type === "load") fake.handlers.message(ready);
      if (msg.type === "invoke")
        fake.handlers.message({ type: "result", id: msg.id, ok: true, result: "done" });
    },
    { maxConcurrent: 1, timeoutMs: 50, beforeStart: () => Bun.sleep(200) },
  );
  const first = host.invoke(ping);
  await expect(host.invoke(ping)).rejects.toThrow("TIMEOUT");
  expect(await first).toBe("done");
  expect(await host.invoke(ping)).toBe("done");
  host.stop();
});
