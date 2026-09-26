import { afterAll, describe, expect, test } from "bun:test";
import { isPublicAddress, proxyFetch } from "./net-proxy";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/echo") {
      return Response.json({ headers: Object.fromEntries(req.headers), method: req.method });
    }
    if (url.pathname === "/redirect-out") return Response.redirect("https://api.kibo.dev/admin", 302);
    if (url.pathname === "/redirect-in") return Response.redirect("https://api.kibo.dev/v1/echo", 302);
    if (url.pathname === "/redirect-same") return Response.redirect("/echo", 307);
    if (url.pathname === "/redirect-other") return Response.redirect("https://other.kibo.dev/echo", 307);
    if (url.pathname === "/see-other") return Response.redirect("https://api.kibo.dev/echo", 303);
    if (url.pathname.startsWith("/v1/loop")) return Response.redirect("https://api.kibo.dev/v1/loop", 302);
    if (url.pathname === "/v1/echo") return Response.json({ ok: true });
    if (url.pathname === "/redirect-http") return Response.redirect("http://api.kibo.dev/echo", 302);
    if (url.pathname === "/redirect-file") {
      return new Response(null, { status: 302, headers: { location: "file:///etc/passwd" } });
    }
    if (url.pathname === "/big") return new Response("x".repeat(2_000));
    if (url.pathname === "/accents")
      return new Response("é".repeat(100), { headers: { "content-type": "text/plain" } });
    if (url.pathname === "/bin")
      return new Response(new Uint8Array([0, 1, 2]), { headers: { "content-type": "image/png" } });
    if (url.pathname === "/cookie")
      return new Response("ok", { headers: { "set-cookie": "s=1", "x-ok": "1", "x-kibo-base64": "1" } });
    if (url.pathname === "/slow") return new Promise(() => undefined);
    return new Response("nope", { status: 404 });
  },
});
afterAll(() => server.stop(true));

type Sent = { url: string; host: string | null; serverName: unknown; headers: Headers };
const sent: Sent[] = [];
const transport = ((
  input: string | URL | Request,
  init?: RequestInit & { tls?: { serverName?: string } },
) => {
  const u = new URL(String(input));
  const headers = new Headers(init?.headers);
  sent.push({ url: u.href, host: headers.get("host"), serverName: init?.tls?.serverName, headers });
  return fetch(`http://127.0.0.1:${server.port}${u.pathname}${u.search}`, init);
}) as typeof fetch;
const opts = { resolve: async () => ["203.0.113.10"], transport };
const GET = { method: "GET" as const, headers: {} };

describe("proxyFetch", () => {
  test("a covered https URL is fetched without credentials headers", async () => {
    const res = await proxyFetch(
      ["api.kibo.dev/echo"],
      "https://api.kibo.dev/echo",
      {
        method: "POST",
        headers: { cookie: "a=1", Authorization: "x", "x-ok": "1", "Proxy-Authorization": "p" },
      },
      opts,
    );
    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.method).toBe("POST");
    expect(body.headers["x-ok"]).toBe("1");
    expect(body.headers.cookie).toBeUndefined();
    expect(body.headers.authorization).toBeUndefined();
    expect(body.headers["proxy-authorization"]).toBeUndefined();
  });
  test("the connection goes to the checked address, with the original host for TLS", async () => {
    sent.length = 0;
    await proxyFetch(null, "https://api.kibo.dev/echo?q=1", GET, opts);
    await proxyFetch(null, "https://api.kibo.dev/echo", GET, {
      ...opts,
      resolve: async () => ["2606:4700::1"],
    });
    expect(sent.map(({ headers, ...rest }) => rest)).toEqual([
      { url: "https://203.0.113.10/echo?q=1", host: "api.kibo.dev", serverName: "api.kibo.dev" },
      { url: "https://[2606:4700::1]/echo", host: "api.kibo.dev", serverName: "api.kibo.dev" },
    ]);
  });
  test("non https, uncovered URLs and private addresses are refused", async () => {
    await expect(proxyFetch(null, "http://api.kibo.dev/echo", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(proxyFetch(["api.kibo.dev/v1"], "https://api.kibo.dev/echo", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(proxyFetch(null, "https://127.0.0.1/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(null, "https://10.0.0.1/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(null, "https://[::ffff:7f00:1]/echo", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(proxyFetch(null, "https://0x7f.1/echo", GET, opts)).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(null, "https://u:p@api.kibo.dev/echo", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(proxyFetch(null, "not a url", GET, opts)).rejects.toThrow("INVALID_INPUT");
    const rebinding = { ...opts, resolve: async () => ["203.0.113.10", "10.0.0.1"] };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", GET, rebinding)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    const metadata = { ...opts, resolve: async () => ["169.254.169.254"] };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", GET, metadata)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    const empty = { ...opts, resolve: async () => [] };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", GET, empty)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });
  test("header names or values that could split the request are refused", async () => {
    const init = { method: "GET" as const, headers: { "x-a": "1\r\nhost: evil" } };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", init, opts)).rejects.toThrow("INVALID_INPUT");
    const badName = { method: "GET" as const, headers: { "x a": "1" } };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", badName, opts)).rejects.toThrow(
      "INVALID_INPUT",
    );
  });
  test("redirects are followed only to covered targets, three times at most", async () => {
    await expect(
      proxyFetch(["api.kibo.dev"], "https://api.kibo.dev/redirect-in", GET, opts),
    ).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      proxyFetch(["api.kibo.dev/redirect-out"], "https://api.kibo.dev/redirect-out", GET, opts),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(proxyFetch(["api.kibo.dev/v1"], "https://api.kibo.dev/v1/loop", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    let hops = 0;
    const flipping = { ...opts, resolve: async () => (hops++ === 0 ? ["203.0.113.10"] : ["192.168.1.1"]) };
    await expect(
      proxyFetch(["api.kibo.dev"], "https://api.kibo.dev/redirect-in", GET, flipping),
    ).rejects.toThrow("PERMISSION_DENIED");
  });
  test("hop-by-hop and framing headers are removed", async () => {
    const hopByHop = {
      connection: "x-ok",
      "keep-alive": "timeout=5",
      te: "trailers",
      trailer: "x-t",
      "transfer-encoding": "chunked",
      upgrade: "websocket",
      "content-length": "999",
      expect: "100-continue",
      "x-ok": "1",
    };
    sent.length = 0;
    const res = await proxyFetch(
      null,
      "https://api.kibo.dev/echo",
      { method: "GET", headers: hopByHop },
      opts,
    );
    const received: Record<string, string> = JSON.parse(res.body).headers;
    expect(received["x-ok"]).toBe("1");
    const forwarded = [...(sent[0]?.headers.keys() ?? [])];
    expect(forwarded.sort()).toEqual(["host", "x-ok"]);
    for (const [name, value] of Object.entries(hopByHop).filter(([n]) => n !== "x-ok")) {
      expect({ name, value: received[name] }).not.toEqual({ name, value });
    }
  });
  test("redirects to http: or file: are refused", async () => {
    await expect(proxyFetch(null, "https://api.kibo.dev/redirect-http", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
    await expect(proxyFetch(null, "https://api.kibo.dev/redirect-file", GET, opts)).rejects.toThrow(
      "PERMISSION_DENIED",
    );
  });
  test("request headers follow a redirect only on the same origin", async () => {
    const init = { method: "GET" as const, headers: { "x-api-key": "k" } };
    const same = JSON.parse((await proxyFetch(null, "https://api.kibo.dev/redirect-same", init, opts)).body);
    expect(same.headers["x-api-key"]).toBe("k");
    const other = JSON.parse(
      (await proxyFetch(null, "https://api.kibo.dev/redirect-other", init, opts)).body,
    );
    expect(other.headers["x-api-key"]).toBeUndefined();
    const post = { method: "POST" as const, headers: {}, body: "b" };
    const seeOther = JSON.parse((await proxyFetch(null, "https://api.kibo.dev/see-other", post, opts)).body);
    expect(seeOther.method).toBe("GET");
  });
  test("large bodies are truncated and flagged, binary bodies are base64, cookies are dropped", async () => {
    expect(
      (await proxyFetch(null, "https://api.kibo.dev/big", GET, { ...opts, maxBytes: 100 })).body,
    ).toHaveLength(100);
    const truncated = await proxyFetch(null, "https://api.kibo.dev/big", GET, { ...opts, maxBytes: 100 });
    expect(truncated.headers["x-kibo-truncated"]).toBe("1");
    const exact = await proxyFetch(null, "https://api.kibo.dev/big", GET, { ...opts, maxBytes: 2_000 });
    expect(exact.body).toHaveLength(2_000);
    expect(exact.headers["x-kibo-truncated"]).toBeUndefined();
    const accents = await proxyFetch(null, "https://api.kibo.dev/accents", GET, { ...opts, maxBytes: 101 });
    expect(accents.body).toBe("é".repeat(50));
    expect(accents.headers["x-kibo-truncated"]).toBe("1");
    const bin = await proxyFetch(null, "https://api.kibo.dev/bin", GET, opts);
    expect(bin.headers["x-kibo-base64"]).toBe("1");
    expect(bin.body).toBe("AAEC");
    const cookie = await proxyFetch(null, "https://api.kibo.dev/cookie", GET, opts);
    expect(cookie.headers["set-cookie"]).toBeUndefined();
    expect(cookie.headers["x-ok"]).toBe("1");
    expect(cookie.headers["x-kibo-base64"]).toBeUndefined();
  });
  test("a slow server or a slow resolver times out", async () => {
    await expect(
      proxyFetch(null, "https://api.kibo.dev/slow", GET, { ...opts, timeoutMs: 100 }),
    ).rejects.toThrow("TIMEOUT");
    const hanging = { ...opts, resolve: () => new Promise<string[]>(() => undefined), timeoutMs: 100 };
    await expect(proxyFetch(null, "https://api.kibo.dev/echo", GET, hanging)).rejects.toThrow("TIMEOUT");
  });
  test("errors never carry the query string or the transport message", async () => {
    const failing = {
      ...opts,
      transport: ((input: string | URL | Request) =>
        Promise.reject(new Error(`boom fetching ${String(input)}`))) as typeof fetch,
    };
    const error = await proxyFetch(null, "https://api.kibo.dev/echo?token=SECRET", GET, failing).catch(
      (e) => e,
    );
    expect(String(error.message)).toContain("INTERNAL");
    expect(String(error.message)).not.toContain("SECRET");
    const denied = await proxyFetch(
      ["api.kibo.dev/v1"],
      "https://api.kibo.dev/x?token=SECRET",
      GET,
      opts,
    ).catch((e) => e);
    expect(String(denied.message)).not.toContain("SECRET");
  });
});

test("private, loopback, link-local and multicast addresses are not public", () => {
  const v4 = [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "169.254.169.254",
    "100.64.0.1",
  ];
  const v4More = [
    "100.100.100.200",
    "0.0.0.0",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
    "192.0.0.1",
  ];
  for (const ip of [...v4, ...v4More]) expect(isPublicAddress(ip)).toBe(false);
  const v6 = ["::1", "::", "fe80::1", "fc00::1", "fd12::1", "fd00:ec2::254", "ff02::1", "fec0::1", "100::1"];
  const v6Embedded = [
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:8.8.8.8",
    "::127.0.0.1",
    "::ffff:0:7f00:1",
  ];
  const v6Tunnels = [
    "64:ff9b::7f00:1",
    "64:ff9b:1::1",
    "2002:7f00:1::",
    "2001:0:1::1",
    "2001:db8::1",
    "fe80::1%lo0",
  ];
  for (const ip of [...v6, ...v6Embedded, ...v6Tunnels]) expect(isPublicAddress(ip)).toBe(false);
  for (const ip of [
    "1.1.1.1",
    "8.8.8.8",
    "203.0.113.10",
    "2606:4700:4700::1111",
    "2a00:1450:4007:80e::200e",
  ]) {
    expect(isPublicAddress(ip)).toBe(true);
  }
  for (const ip of ["not-an-ip", "", "1.2.3", "::ffff:zz:1"]) expect(isPublicAddress(ip)).toBe(false);
});
