import { afterEach, beforeEach, expect, test } from "bun:test";
import { createIntegrationFetch } from "../../integrations/net";
import { createRedactor } from "../../integrations/redact";
import { FAKE_FIGMA_IMAGE_HOST, type FakeFigma, startFakeFigma } from "../../testing/fake-figma";
import { createFigmaRest } from "./figma-rest";

const KEY = { provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" } as const;
let figma: FakeFigma;
let rest: ReturnType<typeof createFigmaRest>;
let token: string | null = "figd_TESTSECRET";
const clock = { now: 1_000 };
const redactor = createRedactor();

beforeEach(() => {
  token = "figd_TESTSECRET";
  figma = startFakeFigma({ token: "figd_TESTSECRET", handle: "adam" });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets", width: 1440, height: 900 });
  const aliases = new Map([
    ["api.figma.com", new URL(`${figma.url}/`)],
    [FAKE_FIGMA_IMAGE_HOST, new URL(`${figma.url}/`)],
  ]);
  rest = createFigmaRest({
    fetch: createIntegrationFetch({ aliases }),
    token: async () => token,
    redactor,
    now: () => clock.now,
  });
});
afterEach(() => figma.stop());

test("me verifies a token and yields the handle", async () => {
  expect(await rest.me("figd_TESTSECRET")).toEqual({ handle: "adam", email: "adam@example.test" });
  await expect(rest.me("wrong")).rejects.toThrow("REMOTE_REJECTED");
});

test("metadata and version come from the nodes endpoint, render from images", async () => {
  expect(await rest.version(KEY)).toBe("1");
  expect(await rest.metadata(KEY)).toEqual({ name: "Tickets", width: 1440, height: 900 });
  const render = await rest.render(KEY);
  expect(render).toMatchObject({ meta: { name: "Tickets" }, mime: "image/png", version: "1" });
  expect(render.body.slice(0, 4)).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
  expect(figma.requests.filter((r) => r.path.startsWith("/img/")).every((r) => r.token === null)).toBe(true);
  expect(figma.requests.find((r) => r.path.startsWith("/v1/images/"))?.path).toBe("/v1/images/AbC123xyz");
  figma.bump("AbC123xyz");
  expect(await rest.version(KEY)).toBe("2");
});

test("codes: unknown node, unknown file, refused token, unavailable", async () => {
  await expect(rest.render({ ...KEY, nodeId: "9:9" })).rejects.toThrow("REMOTE_NOT_FOUND");
  await expect(rest.version({ ...KEY, fileKey: "Nope00" })).rejects.toThrow("REMOTE_NOT_FOUND");
  token = "wrong";
  await expect(rest.version(KEY)).rejects.toThrow("REMOTE_REJECTED");
  token = "figd_TESTSECRET";
  figma.failNext(503);
  await expect(rest.version(KEY)).rejects.toThrow("REMOTE_UNAVAILABLE");
  token = null;
  expect(await rest.connected()).toBe(false);
  await expect(rest.version(KEY)).rejects.toThrow("NOT_CONNECTED");
});

test("a penpot key is refused without any request", async () => {
  const before = figma.requests.length;
  const penpot = {
    provider: "penpot",
    instance: "https://design.penpot.app",
    fileId: "33333333-3333-4333-8333-333333333333",
    pageId: "44444444-4444-4444-8444-444444444444",
    boardId: "55555555-5555-4555-8555-555555555555",
  } as const;
  await expect(rest.render(penpot)).rejects.toThrow("INVALID_INPUT");
  expect(figma.requests.length).toBe(before);
});

test("a 429 pauses the provider until retry-after, without any request meanwhile", async () => {
  figma.rate.remaining = 0;
  figma.rate.retryAfter = 90;
  await expect(rest.version(KEY)).rejects.toThrow("RATE_LIMITED");
  const before = figma.requests.length;
  await expect(rest.version(KEY)).rejects.toThrow("RATE_LIMITED");
  expect(figma.requests.length).toBe(before);
  figma.rate.remaining = 10;
  clock.now += 90_001;
  expect(await rest.version(KEY)).toBe("1");
});

test("an echoed token is redacted from errors", async () => {
  figma.failNext(500, JSON.stringify({ err: "bad token figd_TESTSECRET" }));
  const e = await rest.version(KEY).catch((x: unknown) => x);
  expect(String(e)).toContain("REMOTE_UNAVAILABLE");
  expect(String(e)).not.toContain("figd_TESTSECRET");
});
