import { shellFiles, strategyFor } from "./sw-policy";

declare let self: ServiceWorkerGlobalScope;

const CACHE = "kibo-phone-shell";
const MANIFEST = "/.vite/manifest.json";
const SHELL = "/index.html";

async function precache(): Promise<void> {
  const manifest = await (await fetch(MANIFEST, { cache: "no-store" })).json();
  await (await caches.open(CACHE)).addAll(shellFiles(manifest));
}

async function staleWhileRevalidate(request: Request, event: FetchEvent): Promise<Response> {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (!cached) return fresh;
  event.waitUntil(fresh.catch((e: unknown) => console.error("[kibo-phone-sw] revalidation failed", e)));
  return cached;
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(new URL(request.url), self.location.origin, request.mode, request.method);
  if (strategy === "network") return;
  event.respondWith(staleWhileRevalidate(strategy === "shell" ? new Request(SHELL) : request, event));
});
