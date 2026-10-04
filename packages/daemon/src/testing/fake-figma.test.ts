import { afterEach, beforeEach, expect, test } from "bun:test";
import { FAKE_FIGMA_IMAGE_HOST, type FakeFigma, startFakeFigma } from "./fake-figma";

let figma: FakeFigma;
const auth = (token = figma.token) => ({ "x-figma-token": token });
beforeEach(() => {
  figma = startFakeFigma({ token: "figd_TEST", handle: "adam" });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets", width: 1440, height: 900 });
});
afterEach(() => figma.stop());

test("me requires the token header", async () => {
  expect((await fetch(`${figma.url}/v1/me`)).status).toBe(403);
  expect((await fetch(`${figma.url}/v1/me`, { headers: auth("wrong") })).status).toBe(403);
  const res = await fetch(`${figma.url}/v1/me`, { headers: auth() });
  expect(await res.json()).toMatchObject({ handle: "adam", email: "adam@example.test" });
});

test("nodes return the file version and the node box", async () => {
  const res = await fetch(`${figma.url}/v1/files/AbC123xyz/nodes?ids=12:34&depth=1`, { headers: auth() });
  expect(await res.json()).toMatchObject({
    name: "Kibo",
    version: "1",
    nodes: {
      "12:34": {
        document: {
          id: "12:34",
          name: "Tickets",
          type: "FRAME",
          absoluteBoundingBox: { width: 1440, height: 900 },
        },
      },
    },
  });
  expect(figma.bump("AbC123xyz")).toBe(2);
  expect((await fetch(`${figma.url}/v1/files/nope/nodes?ids=1:2`, { headers: auth() })).status).toBe(404);
});

test("images return a downloadable url on the s3 host, null for an unknown node", async () => {
  const res = await fetch(`${figma.url}/v1/images/AbC123xyz?ids=12:34,9:9&format=png&scale=2`, {
    headers: auth(),
  });
  const body = (await res.json()) as { err: null; images: Record<string, string | null> };
  expect(body.images["9:9"]).toBeNull();
  const image = new URL(body.images["12:34"] ?? "");
  expect(image.host).toBe(FAKE_FIGMA_IMAGE_HOST);
  const png = await fetch(`${figma.url}${image.pathname}`);
  expect(png.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await png.arrayBuffer()).slice(0, 4)).toEqual(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );
});

test("rate limit and failNext", async () => {
  figma.rate.remaining = 0;
  figma.rate.retryAfter = 30;
  const limited = await fetch(`${figma.url}/v1/images/AbC123xyz?ids=12:34`, { headers: auth() });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("30");
  figma.rate.remaining = 100;
  figma.failNext(500, "boom");
  expect((await fetch(`${figma.url}/v1/me`, { headers: auth() })).status).toBe(500);
  expect((await fetch(`${figma.url}/v1/me`, { headers: auth() })).status).toBe(200);
  expect(figma.requests.map((r) => r.path)).toContain("/v1/me");
});

test("failNext can carry headers", async () => {
  figma.failNext(429, "slow down", { "retry-after": "2" });
  const limited = await fetch(`${figma.url}/v1/me`, { headers: auth() });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("2");
  expect((await fetch(`${figma.url}/v1/me`, { headers: auth() })).status).toBe(200);
});
