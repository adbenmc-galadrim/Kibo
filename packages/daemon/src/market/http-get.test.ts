import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Server } from "bun";
import { createHttpGet } from "./http-get";

let server: Server<undefined>;
let base: string;
let endlessPulls = 0;

function endless(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull(controller) {
      endlessPulls += 1;
      controller.enqueue(new Uint8Array(256));
    },
  });
}

function stalled(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("start"));
    },
  });
}

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/ok") return new Response("hello");
      if (path === "/big") return new Response("x".repeat(2048));
      if (path === "/endless") return new Response(endless());
      if (path === "/stalled") return new Response(stalled());
      if (path === "/slow") {
        await Bun.sleep(300);
        return new Response("late");
      }
      if (path === "/same") return new Response(null, { status: 302, headers: { location: "/ok" } });
      if (path === "/other") {
        return new Response(null, {
          status: 302,
          headers: { location: `http://localhost:${server.port}/ok` },
        });
      }
      if (path === "/private") {
        return new Response(null, { status: 302, headers: { location: "http://10.0.0.1/ok" } });
      }
      if (path === "/loop") return new Response(null, { status: 302, headers: { location: "/loop" } });
      return new Response("missing", { status: 404 });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(() => server.stop(true));

const get = createHttpGet({ allowLoopbackHttp: true, log: () => {} });
const opts = { timeoutMs: 1000, maxBytes: 1024 };
const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("createHttpGet", () => {
  test("downloads a loopback resource when loopback http is allowed", async () => {
    expect(text(await get(`${base}/ok`, opts))).toBe("hello");
  });

  test("refuses plain http outside loopback", async () => {
    await expect(get("http://example.com/index.json", opts)).rejects.toThrow("TLS_REQUIRED");
  });

  test("refuses loopback http when not allowed", async () => {
    const strict = createHttpGet({ allowLoopbackHttp: false, log: () => {} });
    await expect(strict(`${base}/ok`, opts)).rejects.toThrow("TLS_REQUIRED");
  });

  test("follows a redirect on the same host", async () => {
    expect(text(await get(`${base}/same`, opts))).toBe("hello");
  });

  test("refuses a redirect to another host", async () => {
    await expect(get(`${base}/other`, opts)).rejects.toThrow("redirect to another host");
    await expect(get(`${base}/private`, opts)).rejects.toThrow("redirect to another host");
  });

  test("stops after three redirects", async () => {
    await expect(get(`${base}/loop`, opts)).rejects.toThrow("too many redirects");
  });

  test("cuts a body larger than maxBytes", async () => {
    await expect(get(`${base}/big`, opts)).rejects.toThrow("INVALID_INPUT");
  });

  test("cuts an endless body without length while it is streamed", async () => {
    endlessPulls = 0;
    await expect(get(`${base}/endless`, opts)).rejects.toThrow("INVALID_INPUT");
    await Bun.sleep(50);
    const pulled = endlessPulls;
    await Bun.sleep(50);
    expect(endlessPulls).toBe(pulled);
  });

  test("gives up after the timeout", async () => {
    await expect(get(`${base}/slow`, { timeoutMs: 50, maxBytes: 1024 })).rejects.toThrow("TIMEOUT");
  });

  test("gives up on a body that stalls after its first bytes", async () => {
    await expect(get(`${base}/stalled`, { timeoutMs: 100, maxBytes: 1024 })).rejects.toThrow("TIMEOUT");
  });

  test("maps a 404 to NOT_FOUND", async () => {
    await expect(get(`${base}/nope`, opts)).rejects.toThrow("NOT_FOUND");
  });

  test("errors name no host nor port and the detail goes to the log", async () => {
    const log = mock((_m: string, _e: unknown) => {});
    const quiet = createHttpGet({ allowLoopbackHttp: true, log });
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
    const deadPort = closed.port;
    closed.stop(true);
    const failures = await Promise.all(
      [`${base}/nope`, `${base}/other`, `http://127.0.0.1:${deadPort}/`, "http://example.com/"].map((url) =>
        quiet(url, opts).then(
          () => "",
          (e: unknown) => String(e),
        ),
      ),
    );
    for (const failure of failures) {
      expect(failure).not.toBe("");
      expect(failure).not.toContain("127.0.0.1");
      expect(failure).not.toContain(String(server.port));
      expect(failure).not.toContain(String(deadPort));
      expect(failure).not.toContain("example.com");
    }
    expect(log).toHaveBeenCalledTimes(4);
    expect(log.mock.calls.map(([message]) => message)).toContain(`market: GET ${base}/nope failed`);
  });
});
