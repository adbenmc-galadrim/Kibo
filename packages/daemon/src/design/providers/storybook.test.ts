import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  KiboError,
  STORYBOOK_CACHE_MS,
  STORYBOOK_INDEX_MAX_BYTES,
  STORYBOOK_INDEX_MS,
  STORYBOOK_PROBE_MS,
} from "@kibo/schema";
import { createIntegrationFetch } from "../../integrations/net";
import type { IntegrationFetch, IntegrationResponse } from "../../integrations/types";
import { type FakeStorybook, startFakeStorybook } from "../../testing/fake-storybook";
import { createStorybook, type StorybookClient } from "./storybook";

let sb: FakeStorybook;
let client: StorybookClient;
let logged: string[];
const clock = { now: 1_000 };

beforeEach(() => {
  sb = startFakeStorybook();
  sb.addStory("screens-home--default", "Screens/Home", "Default");
  logged = [];
  clock.now = 1_000;
  client = createStorybook({
    fetch: createIntegrationFetch({ aliases: new Map() }),
    now: () => clock.now,
    log: (m) => logged.push(m),
  });
});
afterEach(() => sb.stop());

const response = (status: number, body: string, truncated = false): IntegrationResponse => ({
  status,
  headers: new Headers(),
  body: new TextEncoder().encode(body),
  truncated,
  url: "https://sb.example.com/index.json",
});

test("probe is true while the storybook answers, false once it is offline", async () => {
  expect(await client.probe(sb.url)).toBe(true);
  sb.offline = true;
  client.forget(sb.url);
  expect(await client.probe(sb.url)).toBe(false);
  expect(sb.requests.map((r) => r.path)).toEqual(["/iframe.html", "/iframe.html"]);
});

test("probe results are cached 30 s per origin, forget drops them", async () => {
  await client.probe(sb.url);
  clock.now += 10_000;
  expect(await client.probe(sb.url)).toBe(true);
  expect(sb.requests).toHaveLength(1);
  clock.now += STORYBOOK_CACHE_MS;
  await client.probe(sb.url);
  expect(sb.requests).toHaveLength(2);
  client.forget(sb.url);
  await client.probe(sb.url);
  expect(sb.requests).toHaveLength(3);
});

test("index parses index.json and caches it 30 s", async () => {
  const index = await client.index(sb.url);
  expect(index?.entries["screens-home--default"]).toMatchObject({ title: "Screens/Home", name: "Default" });
  clock.now += 10_000;
  await client.index(sb.url);
  expect(sb.requests.filter((r) => r.path === "/index.json")).toHaveLength(1);
  client.forget(sb.url);
  await client.index(sb.url);
  expect(sb.requests.filter((r) => r.path === "/index.json")).toHaveLength(2);
});

test("a missing index (Storybook 6) is null without a log", async () => {
  sb.noIndex = true;
  expect(await client.index(sb.url)).toBeNull();
  expect(logged).toEqual([]);
});

test("invalid json, an unexpected shape or a truncated index is null and logged", async () => {
  for (const res of [
    response(200, "{not json"),
    response(200, JSON.stringify({ v: 5 })),
    response(200, "{}", true),
  ]) {
    const local = createStorybook({
      fetch: async () => res,
      now: () => clock.now,
      log: (m) => logged.push(m),
    });
    expect(await local.index("https://sb.example.com")).toBeNull();
  }
  expect(logged).toHaveLength(3);
  expect(logged[2]).toContain("TOO_LARGE");
});

test("a failing index request is null and logged", async () => {
  const local = createStorybook({
    fetch: async () => {
      throw new KiboError("TIMEOUT", "request to sb.example.com timed out");
    },
    now: () => clock.now,
    log: (m) => logged.push(m),
  });
  expect(await local.index("https://sb.example.com")).toBeNull();
  expect(logged[0]).toContain("TIMEOUT");
});

test("requests carry no auth and allow http only on a loopback origin", async () => {
  const fetch = mock<IntegrationFetch>(async () => response(200, JSON.stringify({ entries: {} })));
  const local = createStorybook({ fetch, now: () => clock.now, log: () => {} });
  await local.probe("http://localhost:6006");
  await local.index("http://127.0.0.1:6007");
  await local.probe("https://sb.example.com");
  expect(fetch.mock.calls).toEqual([
    [
      "http://localhost:6006/iframe.html",
      { method: "GET", timeoutMs: STORYBOOK_PROBE_MS, maxBytes: 65_536 },
      [{ host: "localhost", suffix: false, auth: false, insecureLoopback: true }],
    ],
    [
      "http://127.0.0.1:6007/index.json",
      { method: "GET", timeoutMs: STORYBOOK_INDEX_MS, maxBytes: STORYBOOK_INDEX_MAX_BYTES },
      [{ host: "127.0.0.1", suffix: false, auth: false, insecureLoopback: true }],
    ],
    [
      "https://sb.example.com/iframe.html",
      { method: "GET", timeoutMs: STORYBOOK_PROBE_MS, maxBytes: 65_536 },
      [{ host: "sb.example.com", suffix: false, auth: false }],
    ],
  ]);
});

test("a probe answering an error status is false", async () => {
  const local = createStorybook({
    fetch: async () => response(500, ""),
    now: () => clock.now,
    log: () => {},
  });
  expect(await local.probe("https://sb.example.com")).toBe(false);
});
