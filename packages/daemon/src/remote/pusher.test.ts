import { expect, test } from "bun:test";
import { deriveKeys, generateRootKey, type MacMessage, openSnapshot, type Sealed } from "@kibo/remote";
import { createFakeTimers } from "./fake-timers.test-helper";
import { createPusher } from "./pusher";
import type { BuildResult, SnapshotBlock, SnapshotBuilder } from "./snapshot-builder";

const utf8 = new TextEncoder();
const MIB = 1_048_576;

function fakeBuilder(contents: Map<string, Map<string, string>>) {
  const sent = new Map<string, string>();
  let resets = 0;
  const diff = (projectId: string): BuildResult => {
    const put: SnapshotBlock[] = [];
    for (const [kind, text] of contents.get(projectId) ?? []) {
      const key = `${projectId}/${kind}`;
      if (sent.get(key) === text) continue;
      sent.set(key, text);
      put.push({ projectId, kind, plaintext: utf8.encode(text) });
    }
    return { put, removed: [] };
  };
  const builder: SnapshotBuilder = {
    buildAll: async (projectId) => diff(projectId),
    buildIndex: async () => diff("_"),
    forget: (projectId) => {
      for (const key of sent.keys()) if (key.startsWith(`${projectId}/`)) sent.delete(key);
    },
    reset: () => {
      resets++;
      sent.clear();
    },
  };
  return { builder, resets: () => resets };
}

const silo = () =>
  new Map([
    [
      "silo",
      new Map([
        ["project", "{}"],
        ["events", "[]"],
      ]),
    ],
    ["_", new Map([["projects", '{"projects":[]}']])],
  ]);

async function setup(contents = silo(), projects = ["silo"]) {
  const timers = createFakeTimers();
  const keys = await deriveKeys(generateRootKey(), "acc", 1);
  const messages: MacMessage[] = [];
  const logs: string[] = [];
  const fake = fakeBuilder(contents);
  const make = () =>
    createPusher({
      builder: fake.builder,
      keys: () => keys,
      send: (message) => {
        messages.push(message);
        return true;
      },
      projects: () => projects,
      now: timers.now,
      log: (line) => logs.push(line),
      timers,
    });
  return { timers, keys, messages, logs, contents, fake, make, pusher: make() };
}

const puts = (messages: MacMessage[]) =>
  messages.flatMap((m) => (m.type === "snapshot.put" ? [m.sealed] : []));
const keysOf = (sealed: Sealed[]) => sealed.map((s) => `${s.header.projectId}/${s.header.kind}`).sort();

test("a project change pushes within 2 s and groups bursts", async () => {
  const s = await setup();
  s.pusher.changed("silo");
  await s.timers.advance(500);
  s.contents.get("silo")?.set("project", '{"v":2}');
  s.pusher.changed("silo");
  s.pusher.changed(null);
  await s.timers.advance(1_000);
  expect(s.messages).toEqual([]);
  await s.timers.advance(500);
  await s.pusher.idle();
  expect(keysOf(puts(s.messages))).toEqual(["_/projects", "silo/events", "silo/project"]);
  const project = puts(s.messages).find((p) => p.header.kind === "project");
  if (!project) throw new Error("no project block");
  expect(new TextDecoder().decode(await openSnapshot(s.keys, project))).toBe('{"v":2}');
  expect(s.pusher.lastPushAt()).toBe(s.timers.now());
});

test("a change of a project that is not enabled pushes nothing", async () => {
  const s = await setup();
  s.pusher.changed("atelier");
  await s.timers.advance(5_000);
  await s.pusher.idle();
  expect(s.messages).toEqual([]);
});

test("enable pushes everything", async () => {
  const s = await setup();
  await s.pusher.pushAll();
  const before = s.messages.length;
  await s.pusher.pushAll();
  expect(s.fake.resets()).toBe(2);
  expect(s.messages.length).toBe(before * 2);
  expect(keysOf(puts(s.messages.slice(before)))).toEqual(["_/projects", "silo/events", "silo/project"]);
});

test("disabling a project removes its blobs", async () => {
  const s = await setup();
  await s.pusher.pushAll();
  s.messages.length = 0;
  await s.pusher.removeProject("silo");
  expect(s.messages[0]).toEqual({ type: "project.remove", projectId: "silo" });
});

test("a sealed blob over SNAPSHOT_MAX_BYTES is skipped with a REMOTE_TOO_LARGE log line and the others are sent", async () => {
  const contents = silo();
  contents.get("silo")?.set("events", "x".repeat(8 * MIB + 1));
  const s = await setup(contents);
  await s.pusher.pushAll();
  expect(keysOf(puts(s.messages))).toEqual(["_/projects", "silo/project"]);
  expect(s.logs.filter((l) => l.includes("REMOTE_TOO_LARGE") && l.includes("silo/events"))).toHaveLength(1);
});

test("seq increases per project and kind", async () => {
  const s = await setup();
  const seqs = () =>
    puts(s.messages)
      .filter((p) => p.header.kind === "project")
      .map((p) => p.header.seq);
  for (const version of [1, 2, 3]) {
    s.contents.get("silo")?.set("project", `{"v":${version}}`);
    await s.pusher.pushProject("silo");
  }
  const [a = 0, b = 0, c = 0] = seqs();
  expect(a).toBe(s.timers.now());
  expect(b).toBeGreaterThan(a);
  expect(c).toBeGreaterThan(b);
  expect(puts(s.messages).every((p) => p.header.builtAt === s.timers.now() && p.header.keyEpoch === 1)).toBe(
    true,
  );
});

test("after a restart the first block sent has a seq greater than the last one sent before", async () => {
  const s = await setup();
  for (const version of [1, 2, 3]) {
    s.contents.get("silo")?.set("project", `{"v":${version}}`);
    await s.pusher.pushProject("silo");
  }
  const last = Math.max(...puts(s.messages).map((p) => p.header.seq));
  s.pusher.stop();
  s.messages.length = 0;
  await s.timers.advance(1_000);
  const restarted = s.make();
  s.contents.get("silo")?.set("project", '{"v":4}');
  await restarted.pushProject("silo");
  expect(puts(s.messages)[0]?.header.seq).toBeGreaterThan(last);
});
