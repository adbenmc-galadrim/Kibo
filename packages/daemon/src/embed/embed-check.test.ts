import { describe, expect, test } from "bun:test";
import { type EmbedCheck, KiboError } from "@kibo/schema";
import type { IntegrationFetch, IntegrationFetchInit, InternalRule } from "../integrations/types";
import { createEmbedChecker, embedCheckOf } from "./embed-check";

const UI = ["http://127.0.0.1:4317", "http://localhost:4317"];
const of = (status: number, headers: Record<string, string> = {}) =>
  embedCheckOf(status, new Headers(headers), UI);
const refused: EmbedCheck = { ok: false, code: "EMBED_REFUSED" };
const ok: EmbedCheck = { ok: true };

describe("embedCheckOf reads the status and the headers only", () => {
  test.each<[number, Record<string, string>, EmbedCheck]>([
    [200, {}, ok],
    [200, { "x-frame-options": "DENY" }, refused],
    [200, { "x-frame-options": "deny" }, refused],
    [200, { "x-frame-options": "SameOrigin" }, refused],
    [200, { "content-security-policy": "frame-ancestors 'self'" }, refused],
    [200, { "content-security-policy": "frame-ancestors 'none'" }, refused],
    [200, { "content-security-policy": "default-src 'self'; frame-ancestors https://itch.io" }, refused],
    [200, { "content-security-policy": "frame-ancestors *" }, ok],
    [200, { "content-security-policy": "frame-ancestors 'self' http://127.0.0.1:*" }, ok],
    [200, { "content-security-policy": "frame-ancestors http://localhost:4317" }, ok],
    [200, { "content-security-policy": "frame-ancestors http://localhost:9999" }, refused],
    [200, { "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'" }, ok],
    [404, {}, { ok: false, code: "REMOTE_NOT_FOUND" }],
    [401, {}, { ok: false, code: "REMOTE_REJECTED" }],
    [403, {}, { ok: false, code: "REMOTE_REJECTED" }],
    [503, {}, { ok: false, code: "REMOTE_UNAVAILABLE" }],
    [500, {}, { ok: false, code: "REMOTE_UNAVAILABLE" }],
  ])("%d %o", (status, headers, expected) => {
    expect(of(status, headers)).toEqual(expected);
  });

  test("every policy of a multi-policy header must allow the interface", () => {
    expect(of(200, { "content-security-policy": "frame-ancestors *, frame-ancestors 'self'" })).toEqual(
      refused,
    );
    expect(of(200, { "content-security-policy": "default-src 'self', frame-ancestors *" })).toEqual({
      ok: true,
    });
  });
});

type Seen = { url: string; init: IntegrationFetchInit; rules: InternalRule[] };
function fakeFetch(answer: () => { status: number; headers?: Record<string, string> } | Error) {
  const seen: Seen[] = [];
  const fetch: IntegrationFetch = async (url, init, rules) => {
    seen.push({ url, init, rules });
    const a = answer();
    if (a instanceof Error) throw a;
    return {
      status: a.status,
      headers: new Headers(a.headers),
      body: new Uint8Array(),
      truncated: false,
      url,
    };
  };
  return { fetch, seen };
}
const TARGET = "https://itch.io/embed-upload/1?color=333";

describe("createEmbedChecker", () => {
  test("asks the target once by GET, bounded, without credentials, on its exact host", async () => {
    const { fetch, seen } = fakeFetch(() => ({ status: 200 }));
    const checker = createEmbedChecker({ fetch, now: () => 0, uiOrigins: () => UI });
    await checker.check(TARGET, false);
    expect(seen).toEqual([
      {
        url: TARGET,
        init: { method: "GET", timeoutMs: 5000, maxBytes: 65536 },
        rules: [{ host: "itch.io", suffix: false, auth: false }],
      },
    ]);
    expect(seen[0]?.init.bearer).toBeUndefined();
  });

  test("an ok result is cached one hour, refresh asks again", async () => {
    let now = 0;
    const { fetch, seen } = fakeFetch(() => ({ status: 200 }));
    const checker = createEmbedChecker({ fetch, now: () => now, uiOrigins: () => UI });
    await checker.check(TARGET, false);
    now = 3_599_999;
    await checker.check(TARGET, false);
    expect(seen).toHaveLength(1);
    await checker.check(TARGET, true);
    expect(seen).toHaveLength(2);
    now = 3_599_999 + 3_600_000;
    await checker.check(TARGET, false);
    expect(seen).toHaveLength(3);
  });

  test("a refusal is thrown and cached sixty seconds", async () => {
    let now = 0;
    const { fetch, seen } = fakeFetch(() => ({ status: 200, headers: { "x-frame-options": "DENY" } }));
    const checker = createEmbedChecker({ fetch, now: () => now, uiOrigins: () => UI });
    await expect(checker.check(TARGET, false)).rejects.toThrow("EMBED_REFUSED");
    now = 59_999;
    await expect(checker.check(TARGET, false)).rejects.toThrow("EMBED_REFUSED");
    expect(seen).toHaveLength(1);
    now = 60_000;
    await expect(checker.check(TARGET, false)).rejects.toThrow("EMBED_REFUSED");
    expect(seen).toHaveLength(2);
  });

  test("a transport failure is thrown as is and never cached", async () => {
    let failure: Error = new KiboError("TIMEOUT", "request to itch.io timed out");
    const { fetch, seen } = fakeFetch(() => failure);
    const checker = createEmbedChecker({ fetch, now: () => 0, uiOrigins: () => UI });
    await expect(checker.check(TARGET, false)).rejects.toThrow("TIMEOUT");
    failure = new KiboError("REMOTE_UNAVAILABLE", "request to itch.io failed (ECONNREFUSED)");
    await expect(checker.check(TARGET, false)).rejects.toThrow("REMOTE_UNAVAILABLE");
    expect(seen).toHaveLength(2);
  });

  test("keeps at most 256 targets, the oldest leaves first", async () => {
    const { fetch, seen } = fakeFetch(() => ({ status: 200 }));
    const checker = createEmbedChecker({ fetch, now: () => 0, uiOrigins: () => UI });
    for (let i = 0; i <= 256; i++) await checker.check(`https://itch.io/embed-upload/${i}`, false);
    expect(seen).toHaveLength(257);
    await checker.check("https://itch.io/embed-upload/256", false);
    await checker.check("https://itch.io/embed-upload/1", false);
    expect(seen).toHaveLength(257);
    await checker.check("https://itch.io/embed-upload/0", false);
    expect(seen).toHaveLength(258);
  });
});
