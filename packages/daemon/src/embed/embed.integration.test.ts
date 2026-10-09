import { afterAll, afterEach, beforeAll, expect, setSystemTime, test } from "bun:test";
import { cpSync } from "node:fs";
import { join } from "node:path";
import { copyFixture } from "@kibo/devkit/test-kit";
import { EMBED_ATTRIBUTES, EmbedView } from "@kibo/schema";
import { z } from "zod";
import { readJournal } from "../components/exit.test-helper";
import { type FakeItch, startFakeItch } from "../testing/fake-itch";
import { bootEmbedDaemon, type EmbedDaemon } from "./embed-daemon.test-helper";

const GAME = "https://itch.io/embed-upload/1?color=333333";
const Published = z.object({ version: z.object({ hash: z.string() }) });

let itch: FakeItch;
let kibo: EmbedDaemon;
let projectId = "";

beforeAll(async () => {
  itch = startFakeItch();
  kibo = await bootEmbedDaemon(`itch.io=${itch.url}`);
  projectId = await kibo.project(null);
}, 60_000);
afterAll(async () => {
  await kibo.stop();
  itch.stop();
});
afterEach(() => {
  setSystemTime();
});

const game = () => kibo.widget(projectId, "itch@1.0.0", { embed: GAME });
const open = async (instanceId: string, url: string) =>
  EmbedView.parse(await kibo.client.ok(kibo.call(projectId, instanceId, { kind: "embed.open", url })));
const refusal = (instanceId: string, url: string) =>
  kibo.client.refused(kibo.call(projectId, instanceId, { kind: "embed.open", url }));
const relay = (url: string, init: RequestInit = {}) => fetch(url, init);

test("a builtin game widget gets a relay page whose iframe targets the faked itch.io", async () => {
  const view = await open(await game(), GAME);
  expect(view).toMatchObject({ kind: "game", target: GAME, ...EMBED_ATTRIBUTES.game });
  expect(view.url.startsWith(`http://127.0.0.1:${kibo.daemon.sandboxPort}/e/`)).toBe(true);
  const res = await relay(view.url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toStartWith("text/html");
  expect(res.headers.get("content-security-policy")).toContain(`frame-src ${itch.url};`);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const html = await res.text();
  expect(html).toContain(`src="${itch.url}/embed-upload/1?color=333333"`);
  expect(html.match(/<iframe/g)).toHaveLength(1);
  expect(html).not.toContain("<script");
  expect(itch.requests).toContainEqual({ method: "GET", path: "/embed-upload/1" });
});

test("the relay refuses foreign hosts, expired tokens and non-GET methods", async () => {
  const view = await open(await game(), GAME);
  expect((await relay(view.url)).status).toBe(200);
  expect((await relay(view.url)).status).toBe(200);
  expect((await relay(view.url, { method: "POST" })).status).toBe(405);
  expect((await relay(view.url, { method: "HEAD" })).status).toBe(405);
  expect((await relay(view.url, { headers: { host: "evil.example" } })).status).toBe(403);
  const sandbox = new URL(view.url).origin;
  expect((await relay(`${sandbox}/e/${"0".repeat(64)}`)).status).toBe(404);
  expect((await relay(`${sandbox}/e/not-a-token`)).status).toBe(404);
  setSystemTime(new Date(Date.now() + 16 * 60_000));
  expect((await relay(view.url)).status).toBe(404);
});

test("itch refusals are reported by code: refused, not found, offline", async () => {
  const instanceId = await game();
  expect(await refusal(instanceId, "https://itch.io/embed-upload/2")).toMatchObject({
    code: "EMBED_REFUSED",
  });
  expect(await refusal(instanceId, "https://itch.io/embed-upload/4")).toMatchObject({
    code: "EMBED_REFUSED",
  });
  expect(await refusal(instanceId, "https://itch.io/embed-upload/3")).toMatchObject({
    code: "REMOTE_NOT_FOUND",
  });
  expect(await refusal(instanceId, "https://www.itch.io/embed-upload/1")).toMatchObject({
    code: "PERMISSION_DENIED",
  });
  const later = "https://itch.io/embed-upload/1?color=111111";
  await fetch(`${itch.url}/__test/offline`, { method: "POST" });
  expect(await refusal(instanceId, later)).toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  await fetch(`${itch.url}/__test/online`, { method: "POST" });
  expect(await refusal(instanceId, later)).toMatchObject({ code: "REMOTE_UNAVAILABLE" });
  setSystemTime(new Date(Date.now() + 61_000));
  expect((await open(instanceId, later)).target).toBe(later);
});

test("a sandboxed component without cap:embed is refused and journaled", async () => {
  const fixture = copyFixture("undeclared", { linkModules: false });
  cpSync(fixture.dir, join(kibo.home, "components", "src", "undeclared"), { recursive: true });
  fixture.dispose();
  const published = await kibo.client.ok({
    method: "publishComponent",
    id: "undeclared",
    strategy: "new-version",
  });
  const { hash } = Published.parse(published).version;
  await kibo.client.ok({
    method: "approveComponent",
    id: "undeclared",
    version: "0.1.0",
    hash,
    trust: "sandboxed",
  });
  const instanceId = await kibo.widget(projectId, "undeclared@0.1.0");
  expect(await refusal(instanceId, GAME)).toEqual({ status: 403, code: "PERMISSION_DENIED" });
  expect(readJournal(kibo.home, "undeclared@0.1.0")).toContainEqual({
    kind: "embed.open",
    code: "PERMISSION_DENIED",
    count: 1,
  });
}, 60_000);
