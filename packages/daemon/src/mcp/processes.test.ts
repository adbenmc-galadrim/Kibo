import { afterEach, beforeEach, expect, test } from "bun:test";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { commandLineOf } from "./command-line";
import { createMcpHub, type McpHub } from "./hub";
import { crashyServer, groupMembers, pidsMatching, stubbornServer, survivors } from "./processes.test-helper";

let host: FakeHost;
let hub: McpHub;
let secrets: MemorySecretStore;
beforeEach(() => {
  host = createFakeHost();
  const redactor = createRedactor();
  secrets = createMemorySecretStore(redactor);
  hub = createMcpHub({
    host,
    secrets,
    events: createEventLog(host.db, redactor, host.now),
    redact: redactor.redact,
  });
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

test("removing a server kills its whole process group, even one ignoring SIGTERM", async () => {
  const marker = `kibo-mcp-remove-${crypto.randomUUID()}`;
  const server = stubbornServer("stubborn", marker);
  expect((await hub.add(server, commandLineOf(server), {})).state).toBe("connected");
  const pids = pidsMatching(marker);
  expect(pids).toHaveLength(2);
  await hub.remove("stubborn");
  expect(await survivors(pids)).toEqual([]);
}, 10_000);

test("stopping the hub kills every server and refuses new connections", async () => {
  const marker = `kibo-mcp-stop-${crypto.randomUUID()}`;
  const server = stubbornServer("stubborn", marker);
  await hub.add(server, commandLineOf(server), {});
  const pids = pidsMatching(marker);
  expect(pids).toHaveLength(2);
  await hub.stop();
  expect(await survivors(pids)).toEqual([]);
  await expect(hub.tools("stubborn")).rejects.toThrow("MCP_UNAVAILABLE");
}, 10_000);

test("a server whose leader dies takes its whole group with it", async () => {
  const marker = `kibo-mcp-crash-${crypto.randomUUID()}`;
  const server = crashyServer("crashy", marker);
  await hub.add(server, commandLineOf(server), {});
  const [leader] = pidsMatching(marker);
  if (leader === undefined) throw new Error("leader not found");
  const members = groupMembers(leader);
  expect(members).toHaveLength(2);
  process.kill(leader, "SIGKILL");
  expect(await survivors(members)).toEqual([]);
  expect((await hub.views())[0]?.state).toBe("idle");
}, 10_000);

test("a call arriving while a server is being removed does not restart it", async () => {
  const marker = `kibo-mcp-removing-${crypto.randomUUID()}`;
  const server = stubbornServer("stubborn", marker);
  await hub.add(server, commandLineOf(server), {});
  const removing = hub.remove("stubborn");
  await Bun.sleep(100);
  await expect(hub.tools("stubborn")).rejects.toThrow("NOT_FOUND");
  await removing;
  expect(await survivors(pidsMatching(marker))).toEqual([]);
}, 10_000);

test("a group already killed from outside stops cleanly", async () => {
  const marker = `kibo-mcp-outside-${crypto.randomUUID()}`;
  const server = crashyServer("crashy", marker);
  await hub.add(server, commandLineOf(server), {});
  const [leader] = pidsMatching(marker);
  if (leader === undefined) throw new Error("leader not found");
  const members = groupMembers(leader);
  process.kill(-leader, "SIGKILL");
  await hub.stop();
  expect(await survivors(members)).toEqual([]);
}, 10_000);

test("secrets are erased even when closing the server fails", async () => {
  const marker = `kibo-mcp-secret-${crypto.randomUUID()}`;
  const server = { ...stubbornServer("stubborn", marker), envNames: ["TOKEN"] };
  await hub.add(server, commandLineOf(server), { TOKEN: "tok-stubborn-123456" });
  const [leader] = pidsMatching(marker);
  if (leader === undefined) throw new Error("leader not found");
  const kill = process.kill;
  process.kill = (pid: number, signal?: string | number) => {
    if (pid < 0) throw Object.assign(new Error("refused"), { code: "EINVAL" });
    return kill(pid, signal);
  };
  try {
    await expect(hub.remove("stubborn")).rejects.toThrow("refused");
  } finally {
    process.kill = kill;
    kill(-leader, "SIGKILL");
  }
  expect(await secrets.has("mcp:stubborn:TOKEN")).toBe(false);
  expect(await survivors(pidsMatching(marker))).toEqual([]);
}, 10_000);
