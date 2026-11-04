type SwStrategy = "network" | "shell" | "asset";

type ManifestChunk = {
  file: string;
  css?: string[];
  imports?: string[];
  dynamicImports?: string[];
  isEntry?: boolean;
};

const SHELL_ENTRY = "index.html";
const ALWAYS = ["/", "/index.html", "/manifest.webmanifest"];

export function strategyFor(url: URL, origin: string, mode: string, method: string): SwStrategy {
  if (method !== "GET" || url.origin !== origin) return "network";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return "network";
  return mode === "navigate" ? "shell" : "asset";
}

export function shellFiles(manifest: Record<string, ManifestChunk>): string[] {
  const files = new Set(ALWAYS);
  const visit = (name: string) => {
    const chunk = manifest[name];
    if (!chunk || files.has(`/${chunk.file}`)) return;
    files.add(`/${chunk.file}`);
    for (const css of chunk.css ?? []) files.add(`/${css}`);
    for (const imported of chunk.imports ?? []) visit(imported);
    for (const loaded of chunk.dynamicImports ?? []) visit(loaded);
  };
  visit(SHELL_ENTRY);
  return [...files];
}

export const cacheName = (buildId: string): string => `kibo-phone-${buildId}`;

export const staleCaches = (names: string[], current: string): string[] =>
  names.filter((name) => name !== current);

type ShellCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export async function networkFirst(
  request: Request,
  cache: ShellCache,
  load: (request: Request) => Promise<Response>,
): Promise<Response> {
  try {
    const response = await load(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    return (await cache.match(request)) ?? response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}
