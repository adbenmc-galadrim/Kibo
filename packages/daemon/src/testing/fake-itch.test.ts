import { afterEach, beforeEach, expect, test } from "bun:test";
import { type FakeItch, startFakeItch } from "./fake-itch";

let itch: FakeItch;
beforeEach(() => {
  itch = startFakeItch();
});
afterEach(() => itch.stop());
const get = (path: string) => fetch(`${itch.url}${path}`);

test("the first upload is a playable game page that keeps its count in localStorage", async () => {
  const res = await get("/embed-upload/1?color=333333");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(res.headers.get("x-frame-options")).toBeNull();
  expect(res.headers.get("content-security-policy")).toBeNull();
  const page = await res.text();
  expect(page).toContain('data-game="itch"');
  expect(page).toContain(">Jouer</button>");
  expect(page).toContain("Parties : ");
  expect(page).toContain("localStorage");
});

test("the other uploads refuse to be framed or do not exist", async () => {
  expect((await get("/embed-upload/2")).headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect((await get("/embed-upload/3")).status).toBe(404);
  const csp = await get("/embed-upload/4");
  expect(csp.status).toBe(200);
  expect(csp.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
  expect((await get("/elsewhere")).status).toBe(404);
});

test("goes offline and back, and logs every request", async () => {
  expect((await fetch(`${itch.url}/__test/offline`, { method: "POST" })).status).toBe(204);
  expect(itch.offline).toBe(true);
  expect((await get("/embed-upload/1")).status).toBe(503);
  await fetch(`${itch.url}/__test/online`, { method: "POST" });
  expect((await get("/embed-upload/1")).status).toBe(200);
  expect(itch.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
    "POST /__test/offline",
    "GET /embed-upload/1",
    "POST /__test/online",
    "GET /embed-upload/1",
  ]);
});
