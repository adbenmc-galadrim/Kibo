import type { FakeMarket } from "./fake-market";

export type ReceivedPublish = { headers: Headers; body: Uint8Array };

export type TeamProxy = {
  serverUrl: string;
  sourceUrl: string;
  received: ReceivedPublish[];
  answer(body: Uint8Array): Response;
  stop(): void;
};

const MARKET_PREFIX = "/market/";

export function startTeamProxy(fake: FakeMarket): TeamProxy {
  const proxy: TeamProxy = {
    serverUrl: "",
    sourceUrl: "",
    received: [],
    answer: () => Response.json({ ok: true, result: { serial: 2 } }),
    stop: () => {},
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname === "/v1/market/packages") {
        const body = new Uint8Array(await req.arrayBuffer());
        proxy.received.push({ headers: req.headers, body });
        return proxy.answer(body);
      }
      if (req.method === "GET" && url.pathname.startsWith(MARKET_PREFIX)) {
        return fetch(new URL(url.pathname.slice(MARKET_PREFIX.length), fake.url));
      }
      return new Response("not found", { status: 404 });
    },
  });
  proxy.serverUrl = `ws://127.0.0.1:${server.port}`;
  proxy.sourceUrl = `http://127.0.0.1:${server.port}${MARKET_PREFIX}`;
  proxy.stop = () => server.stop(true);
  return proxy;
}
