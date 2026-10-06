import { afterEach, beforeEach, expect, test } from "bun:test";
import { createIntegrationFetch } from "../../integrations/net";
import { createRedactor } from "../../integrations/redact";
import { type FakePenpot, PENPOT_IDS, startFakePenpot } from "../../testing/fake-penpot";
import { createPenpot } from "./penpot";

const SECRET = "penpot-TESTSECRET-0123456789";
let penpot: FakePenpot;
let client: ReturnType<typeof createPenpot>;
let instance: string | null;
let token: string | null;
const clock = { now: 1_000 };
const redactor = createRedactor();
const key = () =>
  ({
    provider: "penpot",
    instance: penpot.url,
    fileId: PENPOT_IDS.file,
    pageId: PENPOT_IDS.page,
    boardId: PENPOT_IDS.board,
  }) as const;

beforeEach(() => {
  penpot = startFakePenpot({ token: SECRET });
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board, {
    name: "Accueil",
    width: 1440,
    height: 900,
  });
  instance = penpot.url;
  token = SECRET;
  client = createPenpot({
    fetch: createIntegrationFetch({ aliases: new Map() }),
    instance: () => instance,
    token: async () => token,
    redactor,
    now: () => clock.now,
  });
});
afterEach(() => penpot.stop());

const mediaOf = () =>
  penpot.files.get(PENPOT_IDS.file)?.pages.get(PENPOT_IDS.page)?.get(PENPOT_IDS.board)?.mediaId;

test("profile verifies a token on an instance", async () => {
  expect(await client.profile(penpot.url, SECRET)).toEqual({ fullname: "Adam", email: "adam@example.test" });
  await expect(client.profile(penpot.url, "wrong-token-123")).rejects.toThrow("REMOTE_REJECTED");
  expect(penpot.requests[0]).toMatchObject({ path: "/api/rpc/command/get-profile", auth: `Token ${SECRET}` });
});

test("metadata comes from get-page, the version is the thumbnail media id", async () => {
  expect(await client.metadata(key())).toEqual({ name: "Accueil", width: 1440, height: 900 });
  expect(await client.version(key())).toBe(mediaOf() ?? "missing");
  const next = penpot.rerender(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.board);
  expect(await client.version(key())).toBe(next);
});

test("render downloads the thumbnail without the token", async () => {
  const render = await client.render(key());
  expect(render).toMatchObject({ meta: { name: "Accueil" }, mime: "image/png", version: mediaOf() });
  expect(render.body.slice(0, 4)).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
  const assets = penpot.requests.filter((r) => r.path.startsWith("/assets/"));
  expect(assets).toHaveLength(1);
  expect(assets.every((r) => r.auth === null)).toBe(true);
});

test("a board without a thumbnail has no version and no render", async () => {
  penpot.addBoard(PENPOT_IDS.file, PENPOT_IDS.page, PENPOT_IDS.bare, { mediaId: null });
  const bare = { ...key(), boardId: PENPOT_IDS.bare };
  expect(await client.version(bare)).toBeNull();
  await expect(client.render(bare)).rejects.toThrow("penpot has no thumbnail for this board yet");
  await expect(client.render(bare)).rejects.toThrow("REMOTE_NOT_RENDERED");
});

test("a realistic page with path shapes still yields the board", async () => {
  expect(await client.metadata(key())).toEqual({ name: "Accueil", width: 1440, height: 900 });
  const page = penpot.requests.find((r) => r.path.endsWith("/get-page"));
  expect(page?.body).toContain(`"object-id":"${PENPOT_IDS.board}"`);
});

test("an anonymous profile means the token was ignored", async () => {
  penpot.ignoreTokens = true;
  await expect(client.profile(penpot.url, SECRET)).rejects.toThrow("TOKEN_IGNORED");
  await expect(client.metadata(key())).rejects.toThrow("REMOTE_REJECTED");
});

test("a 400 answer is a refusal, not an outage", async () => {
  penpot.failNext(400, JSON.stringify({ type: "validation", code: "params-validation" }), {
    "content-type": "application/json",
  });
  await expect(client.metadata(key())).rejects.toThrow("REMOTE_REJECTED");
});

test("an unknown board is not found", async () => {
  await expect(
    client.metadata({ ...key(), boardId: "77777777-7777-4777-8777-777777777777" }),
  ).rejects.toThrow("REMOTE_NOT_FOUND");
});

test("an asset redirect on the instance is followed", async () => {
  penpot.redirectAssets = true;
  const render = await client.render(key());
  expect(render.mime).toBe("image/png");
  expect(penpot.requests.some((r) => r.path.startsWith("/storage/"))).toBe(true);
});

test("an offline instance is unavailable", async () => {
  penpot.offline = true;
  await expect(client.version(key())).rejects.toThrow("REMOTE_UNAVAILABLE");
});

test("a 429 pauses the provider until retry-after", async () => {
  penpot.failNext(429, "", { "retry-after": "120" });
  await expect(client.version(key())).rejects.toThrow("RATE_LIMITED");
  const before = penpot.requests.length;
  await expect(client.metadata(key())).rejects.toThrow("RATE_LIMITED");
  expect(penpot.requests.length).toBe(before);
  clock.now += 120_001;
  expect(await client.version(key())).toBe(mediaOf() ?? "missing");
});

test("no instance or no token means not connected", async () => {
  instance = null;
  expect(await client.connected()).toBe(false);
  await expect(client.version(key())).rejects.toThrow("NOT_CONNECTED");
  instance = penpot.url;
  token = null;
  expect(await client.connected()).toBe(false);
  await expect(client.version(key())).rejects.toThrow("NOT_CONNECTED");
});

test("a frame of another instance is refused without any request", async () => {
  const before = penpot.requests.length;
  await expect(client.render({ ...key(), instance: "https://design.penpot.app" })).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  await expect(client.render({ provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" })).rejects.toThrow(
    "INVALID_INPUT",
  );
  expect(penpot.requests.length).toBe(before);
});

test("an echoed token is redacted from errors", async () => {
  penpot.failNext(500, `invalid token ${SECRET}`);
  const e = await client.version(key()).catch((x: unknown) => x);
  expect(String(e)).toContain("REMOTE_UNAVAILABLE");
  expect(String(e)).not.toContain(SECRET);
});

test("a known secret echoed across the truncation point leaves no fragment", async () => {
  const other = "ghp_OTHERSECRET0123456789abcdef";
  redactor.add(other);
  penpot.failNext(500, `${"x".repeat(190)}${other}`);
  const e = await client.version(key()).catch((x: unknown) => x);
  expect(String(e)).toContain("REMOTE_UNAVAILABLE");
  expect(String(e)).not.toContain(other.slice(0, 8));
});
