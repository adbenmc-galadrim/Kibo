type SwStrategy = "network" | "shell" | "asset";

type ManifestChunk = { file: string; css?: string[]; imports?: string[]; isEntry?: boolean };

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
  };
  visit(SHELL_ENTRY);
  return [...files];
}
