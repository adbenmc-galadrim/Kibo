import { afterEach, describe, expect, test } from "bun:test";
import { sealedRequest } from "./testing/fixtures";
import { connectFakeMac, startTestServer, type TestServer } from "./testing/test-server";

let server: TestServer;
afterEach(() => server.stop());

const post = (cookie: string, body: unknown) =>
  fetch(`${server.url}/api/phone/request`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });

describe("relay", () => {
  test("a phone request is forwarded to the mac and its reply returned (200)", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const request = sealedRequest();
    const reply = sealedRequest(request.header.requestId);
    const seen: unknown[] = [];
    const mac = await connectFakeMac(server.url, macToken, (message) => {
      seen.push(message);
      return reply;
    });
    const res = await post(server.phoneCookie(), { sealed: request });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sealed: reply });
    expect(seen).toEqual([{ type: "request", requestId: request.header.requestId, sealed: request }]);
    await mac.close();
  });

  test("without a mac the request is 503 REMOTE_UNAVAILABLE immediately", async () => {
    server = await startTestServer();
    await server.registerMac();
    const started = performance.now();
    const res = await post(server.phoneCookie(), { sealed: sealedRequest() });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "REMOTE_UNAVAILABLE" } });
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("relay refuses when the mac disconnects mid-request", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    const pending = post(server.phoneCookie(), { sealed: sealedRequest() });
    await mac.next("request");
    await mac.close();
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "REMOTE_UNAVAILABLE" } });
    const back = await connectFakeMac(server.url, macToken);
    await Bun.sleep(50);
    expect(back.received.filter((m) => m.type === "request")).toEqual([]);
    await back.close();
  });

  test("no reply within REQUEST_TIMEOUT_MS is 504 TIMEOUT", async () => {
    server = await startTestServer({ requestTimeoutMs: 50 });
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken, () => null);
    const res = await post(server.phoneCookie(), { sealed: sealedRequest() });
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "TIMEOUT" } });
    await mac.close();
  });

  test("a reply for an unknown request is ignored", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    const stray = sealedRequest();
    mac.put({ type: "request.reply", requestId: stray.header.requestId, sealed: stray });
    mac.put({ type: "ping", at: 1 });
    await mac.next("pong");
    expect(mac.received.filter((m) => m.type === "error")).toEqual([]);
    await mac.close();
  });

  test("a malformed request body is 400 INVALID_INPUT", async () => {
    server = await startTestServer();
    await server.registerMac();
    const res = await post(server.phoneCookie(), { sealed: { header: {} } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });
});
