import { StoryId } from "@kibo/schema";

export type FakeStory = { id: string; title: string; name: string };
export type FakeStorybook = {
  url: string;
  port: number;
  stories: Map<string, FakeStory>;
  requests: { method: string; path: string; query: string }[];
  noIndex: boolean;
  indexOverride: string | null;
  offline: boolean;
  addStory(id: string, title: string, name: string): void;
  stop(): void;
};

const html = (body: string) =>
  new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const COUNTER =
  '<button type="button" id="click">Cliquer</button><p id="count">Clics : 0</p>' +
  '<script>let n=0;document.getElementById("click").addEventListener("click",()=>{n+=1;' +
  'document.getElementById("count").textContent="Clics : "+n;});</script>';

function storyPage(rawId: string | null): Response {
  const id = rawId !== null && StoryId.safeParse(rawId).success ? rawId : null;
  if (id === null) return html('<main id="storybook-root"></main>');
  return html(`<main id="storybook-root" data-story="${id}"><h1>${id}</h1>${COUNTER}</main>`);
}

export function startFakeStorybook(opts: { port?: number } = {}): FakeStorybook {
  const stories = new Map<string, FakeStory>();
  const requests: FakeStorybook["requests"] = [];
  const index = () => ({
    v: 5,
    entries: Object.fromEntries([...stories.values()].map((s) => [s.id, { ...s, type: "story" }])),
  });
  const indexResponse = (): Response => {
    if (state.noIndex) return new Response("not found", { status: 404 });
    if (state.indexOverride !== null)
      return new Response(state.indexOverride, { headers: { "content-type": "application/json" } });
    return Response.json(index());
  };
  const route = (u: URL): Response => {
    if (u.pathname === "/iframe.html") return storyPage(u.searchParams.get("id"));
    if (u.pathname === "/index.json") return indexResponse();
    return new Response("not found", { status: 404 });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    fetch(req) {
      const u = new URL(req.url);
      requests.push({ method: req.method, path: u.pathname, query: u.search });
      if (req.method === "POST" && u.pathname === "/__test/offline") {
        state.offline = true;
        return new Response(null, { status: 204 });
      }
      if (req.method === "POST" && u.pathname === "/__test/online") {
        state.offline = false;
        return new Response(null, { status: 204 });
      }
      if (state.offline) return new Response("service unavailable", { status: 503 });
      if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
      return route(u);
    },
  });
  const port = server.port ?? 0;
  const state: FakeStorybook = {
    url: `http://127.0.0.1:${port}`,
    port,
    stories,
    requests,
    noIndex: false,
    indexOverride: null,
    offline: false,
    addStory(id, title, name) {
      stories.set(id, { id, title, name });
    },
    stop: () => server.stop(true),
  };
  return state;
}
