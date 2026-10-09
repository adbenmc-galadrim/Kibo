export type FakeItch = {
  url: string;
  requests: { method: string; path: string }[];
  offline: boolean;
  stop(): void;
};

const GAME_PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>Faux jeu</title></head>' +
  '<body data-game="itch"><h1>Faux jeu</h1><button type="button" id="play">Jouer</button>' +
  '<p id="count">Parties : 0</p><script>' +
  'const key = "kibo-fake-itch-plays";' +
  'const show = () => { document.getElementById("count").textContent = "Parties : " + (localStorage.getItem(key) ?? "0"); };' +
  'document.getElementById("play").addEventListener("click", () => {' +
  "localStorage.setItem(key, String(Number(localStorage.getItem(key) ?? 0) + 1)); show(); });" +
  "show();</script></body></html>";

const html = (headers: Record<string, string> = {}) =>
  new Response(GAME_PAGE, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });

function route(pathname: string): Response {
  if (pathname === "/embed-upload/1") return html();
  if (pathname === "/embed-upload/2") return html({ "x-frame-options": "SAMEORIGIN" });
  if (pathname === "/embed-upload/4") return html({ "content-security-policy": "frame-ancestors 'self'" });
  return new Response("not found", { status: 404 });
}

export function startFakeItch(opts: { port?: number } = {}): FakeItch {
  const requests: FakeItch["requests"] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    fetch(req) {
      const { pathname } = new URL(req.url);
      requests.push({ method: req.method, path: pathname });
      if (req.method === "POST" && pathname === "/__test/offline") {
        state.offline = true;
        return new Response(null, { status: 204 });
      }
      if (req.method === "POST" && pathname === "/__test/online") {
        state.offline = false;
        return new Response(null, { status: 204 });
      }
      if (state.offline) return new Response("service unavailable", { status: 503 });
      if (req.method !== "GET" && req.method !== "HEAD")
        return new Response("method not allowed", { status: 405 });
      return route(pathname);
    },
  });
  const state: FakeItch = {
    url: `http://127.0.0.1:${server.port}`,
    requests,
    offline: false,
    stop: () => server.stop(true),
  };
  return state;
}
