import { expect, test } from "bun:test";
import type { Transport } from "../components/net-proxy";
import { createPinnedFetch } from "./http-fetch";

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
