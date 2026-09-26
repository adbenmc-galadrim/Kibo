const HOSTS = new Set(["figma.com", "www.figma.com"]);
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
};

export function parseFigmaUrl(raw: string): { fileKey: string; nodeId: string; url: string } | null {
  const text = raw.trim();
  if (!URL.canParse(text)) return null;
  const u = new URL(text);
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) return null;
  const file = /^\/(?:design|file|proto)\/([A-Za-z0-9]{6,64})(?:\/|$)/.exec(u.pathname);
  const node = /^(\d+)[-:](\d+)$/.exec(u.searchParams.get("node-id") ?? "");
  if (!file?.[1] || !node) return null;
  return { fileKey: file[1], nodeId: `${node[1]}:${node[2]}`, url: u.toString() };
}

export function nameFromMetadata(text: string): string | null {
  const m = /\bname="([^"]*)"/.exec(text);
  if (!m?.[1]) return null;
  const name = m[1].replace(/&(?:amp|quot|lt|gt|#39|apos);/g, (e) => ENTITIES[e] ?? e).trim();
  return name ? name.slice(0, 200) : null;
}
