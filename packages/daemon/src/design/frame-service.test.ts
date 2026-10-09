import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  ASSET_URL_TTL_MS,
  DESIGN_FRESH_MS,
  type DesignFrameKey,
  type ImageDesignProvider,
  KiboError,
} from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createRedactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { createFrameCache } from "./frame-cache";
import { createFrameService, type FrameService } from "./frame-service";
import type { FrameMeta, FrameRender } from "./providers/types";

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const IDS =
  "33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";
const penpotUrl = (instance: string) => `${instance}/#/view/${IDS}`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const render = (version: string): FrameRender => ({
  meta: { name: "Tickets", width: 1440, height: 900 },
  body: PNG,
  mime: "image/png",
  version,
});

const fakeProvider = (id: ImageDesignProvider) => ({
  id,
  connected: mock(async () => true),
  version: mock(async (_key: DesignFrameKey): Promise<string | null> => null),
  metadata: mock(
    async (_key: DesignFrameKey): Promise<FrameMeta> => ({ name: "Tickets", width: 1, height: 1 }),
  ),
  render: mock(async (_key: DesignFrameKey): Promise<FrameRender> => {
    throw new KiboError("INTERNAL", "unexpected render");
  }),
});

const unexpected = (): never => {
  throw new KiboError("INTERNAL", "storybook is not part of these tests");
};

let host: FakeHost;
let clock: { now: number };
let figma: ReturnType<typeof fakeProvider>;
let penpot: ReturnType<typeof fakeProvider>;
let penpotInstance: string | null;
let service: FrameService;
const tokenOf = (url: string) => new URL(url).pathname.split("/")[2] ?? "";

beforeEach(() => {
  host = createFakeHost();
  clock = host.clock;
  figma = fakeProvider("figma");
  penpot = fakeProvider("penpot");
  penpotInstance = "http://localhost:9010";
  service = createFrameService({
    cache: createFrameCache({ db: host.db, home: host.home, now: host.now }),
    providers: { figma, penpot },
    penpotInstance: () => penpotInstance,
    sandboxOrigin: () => "http://127.0.0.1:4999",
    now: host.now,
    events: createEventLog(host.db, createRedactor(), host.now),
    storybook: {
      client: { probe: unexpected, index: unexpected, forget: unexpected },
      origins: { list: unexpected, assertAllowed: unexpected },
      embed: { open: unexpected },
    },
  });
});
afterEach(() => host.close());

test("a fresh cache answers without any provider call", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  const first = await service.frame("i1", FIGMA_URL, false, null);
  expect(first).toMatchObject({
    provider: "figma",
    name: "Tickets",
    stale: false,
    reachable: true,
    mime: "image/png",
    source: FIGMA_URL,
  });
  expect(first.url).toMatch(/^http:\/\/127\.0\.0\.1:4999\/d\/[0-9a-f]{64}\/frame\.png$/);
  clock.now += 30 * 60_000;
  await service.frame("i1", FIGMA_URL, false, null);
  expect(figma.version).not.toHaveBeenCalled();
  expect(figma.render).toHaveBeenCalledTimes(1);
});

test("after the fresh window the version is checked; unchanged means no download", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  await service.frame("i1", FIGMA_URL, false, null);
  clock.now += DESIGN_FRESH_MS + 1;
  figma.version.mockResolvedValueOnce("1");
  const again = await service.frame("i1", FIGMA_URL, false, null);
  expect(again.stale).toBe(false);
  expect(again.fetchedAt).toBe(clock.now);
  expect(figma.render).toHaveBeenCalledTimes(1);
  figma.version.mockResolvedValueOnce("2");
  figma.render.mockResolvedValueOnce(render("2"));
  clock.now += DESIGN_FRESH_MS + 1;
  await service.frame("i1", FIGMA_URL, false, null);
  expect(figma.render).toHaveBeenCalledTimes(2);
});

test("an unknown version always renders again", async () => {
  figma.render.mockResolvedValue(render("1"));
  await service.frame("i1", FIGMA_URL, false, null);
  clock.now += DESIGN_FRESH_MS + 1;
  await service.frame("i1", FIGMA_URL, false, null);
  expect(figma.render).toHaveBeenCalledTimes(2);
});

test("refresh forces the version check even when fresh", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  await service.frame("i1", FIGMA_URL, false, null);
  figma.version.mockResolvedValueOnce("1");
  await service.frame("i1", FIGMA_URL, true, null);
  expect(figma.version).toHaveBeenCalledTimes(1);
});

test("offline with a cache serves a stale frame; offline without cache throws", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  await service.frame("i1", FIGMA_URL, false, null);
  clock.now += DESIGN_FRESH_MS + 1;
  figma.version.mockRejectedValueOnce(new KiboError("REMOTE_UNAVAILABLE", "down"));
  expect(await service.frame("i1", FIGMA_URL, false, null)).toMatchObject({
    stale: true,
    reachable: false,
    name: "Tickets",
  });
  figma.version.mockRejectedValueOnce(new KiboError("RATE_LIMITED", "paused"));
  expect(await service.frame("i1", FIGMA_URL, true, null)).toMatchObject({ stale: true, reachable: false });
  figma.render.mockRejectedValueOnce(new KiboError("REMOTE_UNAVAILABLE", "down"));
  await expect(service.frame("i1", FIGMA_URL.replace("12-34", "1-1"), false, null)).rejects.toThrow(
    "REMOTE_UNAVAILABLE",
  );
});

test("not connected: stale cache if any, NOT_CONNECTED otherwise; a deleted frame always throws", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  await service.frame("i1", FIGMA_URL, false, null);
  figma.connected.mockResolvedValue(false);
  clock.now += DESIGN_FRESH_MS + 1;
  expect(await service.frame("i1", FIGMA_URL, false, null)).toMatchObject({ stale: true, reachable: false });
  await expect(service.frame("i1", FIGMA_URL.replace("12-34", "1-1"), false, null)).rejects.toThrow(
    "NOT_CONNECTED",
  );
  figma.connected.mockResolvedValue(true);
  figma.version.mockRejectedValueOnce(new KiboError("REMOTE_NOT_FOUND", "gone"));
  await expect(service.frame("i1", FIGMA_URL, false, null)).rejects.toThrow("REMOTE_NOT_FOUND");
  figma.version.mockRejectedValueOnce(new KiboError("REMOTE_REJECTED", "forbidden"));
  await expect(service.frame("i1", FIGMA_URL, false, null)).rejects.toThrow("REMOTE_REJECTED");
});

test("a hostile url makes no request, a served token opens the cached file, a stale token does not", async () => {
  for (const raw of [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://figma.com.evil.test/design/AbC123xyz/K?node-id=1-2",
    penpotUrl("http://design.penpot.app"),
  ])
    await expect(service.frame("i1", raw, false, null)).rejects.toThrow("INVALID_INPUT");
  expect(figma.version).not.toHaveBeenCalled();
  expect(figma.connected).not.toHaveBeenCalled();
  figma.render.mockResolvedValueOnce(render("1"));
  const frame = await service.frame("i1", FIGMA_URL, false, null);
  expect(await service.open(tokenOf(frame.url))).toMatchObject({ name: "frame.png", mime: "image/png" });
  clock.now += ASSET_URL_TTL_MS + 1;
  expect(await service.open(tokenOf(frame.url))).toBeNull();
});

test("a penpot board of an instance other than the configured one makes no request", async () => {
  for (const instance of ["https://127.0.0.1", "https://design.penpot.app", "http://localhost:9011"])
    await expect(service.frame("i1", penpotUrl(instance), false, null)).rejects.toThrow("INVALID_INPUT");
  penpotInstance = null;
  await expect(service.frame("i1", penpotUrl("https://127.0.0.1"), false, null)).rejects.toThrow(
    "INVALID_INPUT",
  );
  expect(penpot.connected).not.toHaveBeenCalled();
  expect(penpot.render).not.toHaveBeenCalled();
});

test("a penpot board of the configured instance is rendered, then served stale once disconnected", async () => {
  penpot.render.mockResolvedValueOnce({ ...render("media-1"), meta: { name: "Fiche", width: 1, height: 1 } });
  const frame = await service.frame("i1", penpotUrl("http://localhost:9010"), false, null);
  expect(frame).toMatchObject({ provider: "penpot", name: "Fiche", stale: false });
  penpotInstance = null;
  penpot.connected.mockResolvedValue(false);
  clock.now += DESIGN_FRESH_MS + 1;
  expect(await service.frame("i1", penpotUrl("http://localhost:9010"), false, null)).toMatchObject({
    stale: true,
    reachable: false,
  });
});

test("a cached penpot frame whose thumbnail vanished is served stale", async () => {
  const url = penpotUrl("http://localhost:9010");
  penpot.render.mockResolvedValueOnce(render("m1"));
  await service.frame("i1", url, false, null);
  clock.now += DESIGN_FRESH_MS + 1;
  penpot.version.mockResolvedValueOnce(null);
  penpot.render.mockRejectedValueOnce(new KiboError("REMOTE_NOT_RENDERED", "gone"));
  expect(await service.frame("i1", url, false, null)).toMatchObject({
    name: "Tickets",
    stale: true,
    reachable: false,
  });
  penpot.version.mockResolvedValueOnce(null);
  penpot.render.mockRejectedValueOnce(new KiboError("REMOTE_NOT_FOUND", "deleted"));
  await expect(service.frame("i1", url, true, null)).rejects.toThrow("REMOTE_NOT_FOUND");
});

test("the shell instance may hold 256 tokens, a widget 64", async () => {
  figma.render.mockResolvedValueOnce(render("1"));
  const first = await service.frame("i1", FIGMA_URL, false, null);
  for (let i = 0; i < 64; i++) await service.frame("i1", FIGMA_URL, false, null);
  expect(await service.open(tokenOf(first.url))).toBeNull();
  const shellFirst = await service.frame("shell", FIGMA_URL, false, null);
  for (let i = 0; i < 200; i++) await service.frame("shell", FIGMA_URL, false, null);
  expect(await service.open(tokenOf(shellFirst.url))).not.toBeNull();
});

test("metadata goes to the provider of the key", async () => {
  await service.metadata({ provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" });
  expect(figma.metadata).toHaveBeenCalledTimes(1);
  expect(penpot.metadata).not.toHaveBeenCalled();
});
