import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EMBED_ATTRIBUTES, type EmbedView, KiboError, STORYBOOK_DEFAULTS } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createIntegrationFetch } from "../integrations/net";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { type FakeStorybook, startFakeStorybook } from "../testing/fake-storybook";
import { createFrameCache, type FrameCache } from "./frame-cache";
import { createFrameService, type FrameService } from "./frame-service";
import { createStorybook } from "./providers/storybook";
import { createStorybookOrigins } from "./storybook-origins";

const STORY = "screens-home--default";
let host: FakeHost;
let sb: FakeStorybook;
let cache: FrameCache;
let service: FrameService;
let logged: string[];
let opened: { instanceId: string; kind: string; target: string; title: string }[];
const open = mock((instanceId: string, kind: "storybook", target: string, title: string): EmbedView => {
  opened.push({ instanceId, kind, target, title });
  return {
    url: `http://127.0.0.1:4999/e/${"a".repeat(63)}${opened.length}`,
    kind,
    ...EMBED_ATTRIBUTES[kind],
    expiresAt: host.now() + 900_000,
    target,
  };
});
const fakeProvider = () => ({
  connected: mock(async () => true),
  version: mock(async () => null),
  metadata: mock(async () => ({ name: "x", width: 1, height: 1 })),
  render: mock(async () => {
    throw new KiboError("INTERNAL", "unexpected render");
  }),
});
const storyUrl = (origin = sb.url, id = STORY) => `${origin}/?path=/story/${id}`;
const frame = (url = storyUrl(), refresh = false, projectId: string | null = host.projectId) =>
  service.frame("w1", url, refresh, projectId);
const indexReads = () => sb.requests.filter((r) => r.path === "/index.json").length;

beforeEach(() => {
  host = createFakeHost();
  sb = startFakeStorybook();
  sb.addStory(STORY, "Screens/Home", "Default");
  logged = [];
  opened = [];
  open.mockClear();
  cache = createFrameCache({ db: host.db, home: host.home, now: host.now });
  const client = createStorybook({
    fetch: createIntegrationFetch({ aliases: new Map() }),
    now: host.now,
    log: (m) => logged.push(m),
  });
  service = createFrameService({
    cache,
    providers: { figma: { id: "figma", ...fakeProvider() }, penpot: { id: "penpot", ...fakeProvider() } },
    penpotInstance: () => null,
    sandboxOrigin: () => "http://127.0.0.1:4999",
    now: host.now,
    events: createEventLog(host.db, createRedactor(), host.now),
    storybook: {
      client,
      origins: createStorybookOrigins({
        settings: () => ({ ...STORYBOOK_DEFAULTS, origin: sb.url }),
        folder: () => null,
        worktrees: async () => [],
        envPort: () => null,
        client,
        log: (m) => logged.push(m),
      }),
      embed: { open },
    },
  });
});
afterEach(() => {
  sb.stop();
  host.close();
});

test("a story is an html frame served by the relay, named from index.json, never cached", async () => {
  const get = spyOn(cache, "get");
  const put = spyOn(cache, "put");
  expect(await frame()).toEqual({
    id: `storybook:${new URL(sb.url).host}/${STORY}`,
    provider: "storybook",
    name: "Screens/Home / Default",
    width: null,
    height: null,
    url: `http://127.0.0.1:4999/e/${"a".repeat(63)}1`,
    mime: "text/html",
    fetchedAt: host.now(),
    stale: false,
    reachable: true,
    source: `${sb.url}/?path=/story/${STORY}`,
  });
  expect(opened).toEqual([
    {
      instanceId: "w1",
      kind: "storybook",
      target: `${sb.url}/iframe.html?id=${STORY}&viewMode=story`,
      title: "Screens/Home / Default",
    },
  ]);
  expect(get).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
  expect(host.db.query("SELECT count(*) AS n FROM design_cache").get()).toEqual({ n: 0 });
  const dir = join(host.home, "cache", "design");
  expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
});

test("args and globals reach the relay target", async () => {
  await frame(`${sb.url}/iframe.html?id=${STORY}&args=bg:red&globals=theme:dark`);
  expect(opened[0]?.target).toBe(
    `${sb.url}/iframe.html?id=${STORY}&viewMode=story&args=bg%3Ared&globals=theme%3Adark`,
  );
});

test("without index.json the story id is the name, without error", async () => {
  sb.noIndex = true;
  expect((await frame()).name).toBe(STORY);
  expect(logged).toEqual([]);
});

test("an index without the story is REMOTE_NOT_FOUND and opens nothing", async () => {
  await expect(frame(storyUrl(sb.url, "screens-gone--default"))).rejects.toThrow("REMOTE_NOT_FOUND");
  expect(open).not.toHaveBeenCalled();
});

test("a storybook that is down is REMOTE_UNAVAILABLE, never a stale frame", async () => {
  await frame();
  sb.offline = true;
  await expect(frame(storyUrl(), true)).rejects.toThrow("REMOTE_UNAVAILABLE");
  expect(open).toHaveBeenCalledTimes(1);
});

test("two frames within 10 s read index.json once, refresh probes and reads again", async () => {
  await frame();
  host.clock.now += 10_000;
  await frame();
  expect(indexReads()).toBe(1);
  const probes = sb.requests.filter((r) => r.path === "/iframe.html").length;
  await frame(storyUrl(), true);
  expect(indexReads()).toBe(2);
  expect(sb.requests.filter((r) => r.path === "/iframe.html").length).toBe(probes + 1);
});

test("an index of 5 MiB is ignored and logged, the story id names the frame", async () => {
  sb.indexOverride = JSON.stringify({ entries: {}, pad: "x".repeat(5 * 1024 * 1024) });
  expect((await frame()).name).toBe(STORY);
  expect(logged.join("\n")).toContain("TOO_LARGE");
});

test("an origin not declared in the project is refused before any request", async () => {
  await expect(frame(storyUrl("http://localhost:6007"))).rejects.toThrow(
    "storybook origin http://localhost:6007 is not declared in the project",
  );
  expect(sb.requests).toEqual([]);
});

test("a story outside a project (the shell) is INVALID_INPUT", async () => {
  await expect(frame(storyUrl(), false, null)).rejects.toThrow("INVALID_INPUT");
  expect(sb.requests).toEqual([]);
});

test("metadata of a story comes from the index, without size", async () => {
  const key = { provider: "storybook", origin: sb.url, storyId: STORY } as const;
  expect(await service.metadata(key)).toEqual({ name: "Screens/Home / Default", width: null, height: null });
  await expect(service.metadata({ ...key, storyId: "nope--x" })).rejects.toThrow("REMOTE_NOT_FOUND");
});
