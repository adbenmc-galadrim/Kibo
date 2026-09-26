import { expect, test } from "bun:test";
import type { Transport } from "../components/net-proxy";
import { createLoopbackFetch, createPinnedFetch } from "./http-fetch";

test("a remote mcp server is reached at its checked public address only", async () => {
  const sent: { url: string; host: string | undefined; serverName: string | undefined }[] = [];
  const transport: Transport = async (url, init) => {
    sent.push({ url, host: init.headers.host, serverName: init.tls?.serverName });
    return new Response("{}", { status: 200 });
  };
  const pinned = createPinnedFetch({ resolve: async () => ["203.0.113.10"], transport });
  await pinned("https://mcp.example.com/mcp", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  expect(sent).toEqual([
    { url: "https://203.0.113.10/mcp", host: "mcp.example.com", serverName: "mcp.example.com" },
  ]);
  const rebound = createPinnedFetch({ resolve: async () => ["203.0.113.10", "10.0.0.2"], transport });
  await expect(rebound("https://mcp.example.com/mcp", {})).rejects.toThrow("PERMISSION_DENIED");
  await expect(pinned("http://mcp.example.com/mcp", {})).rejects.toThrow("PERMISSION_DENIED");
  expect(sent).toHaveLength(1);
});

test("a loopback mcp server never redirects and localhost must resolve to loopback (N48)", async () => {
  const hits: string[] = [];
  const target = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      hits.push(req.url);
      return new Response("{}");
    },
  });
  const redirector = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () =>
      new Response(null, { status: 307, headers: { location: `http://127.0.0.1:${target.port}/mcp` } }),
  });
  try {
    const loopback = createLoopbackFetch({ resolve: async () => ["127.0.0.1"] });
    const res = await loopback(`http://127.0.0.1:${redirector.port}/mcp`, { method: "POST", body: "{}" });
    expect(res.status).toBe(307);
    expect(hits).toEqual([]);
    expect((await loopback(`http://localhost:${target.port}/mcp`, {})).status).toBe(200);
    const hijacked = createLoopbackFetch({ resolve: async () => ["127.0.0.1", "192.168.1.20"] });
    await expect(hijacked(`http://localhost:${target.port}/mcp`, {})).rejects.toThrow("PERMISSION_DENIED");
    await expect(loopback("http://mcp.example.com/mcp", {})).rejects.toThrow("PERMISSION_DENIED");
    expect(hits).toHaveLength(1);
  } finally {
    redirector.stop(true);
    target.stop(true);
  }
});
