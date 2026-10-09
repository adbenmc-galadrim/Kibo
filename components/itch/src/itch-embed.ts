export type ItchEmbed = { uploadId: string; url: string; color: string | null; page: string | null };

export const ITCH_EMBED_PROBLEMS = ["empty", "page-url", "not-itch", "upload-missing"] as const;
export type ItchEmbedProblem = (typeof ITCH_EMBED_PROBLEMS)[number];

const ITCH_HOST = "itch.io";
const UPLOAD_PATH = /^\/embed-upload\/(\d{1,12})$/;
const COLOR = /^[0-9a-fA-F]{3,8}$/;
const IFRAME = /<iframe\b/i;
const SRC = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HREF = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

type Parsed = { embed: ItchEmbed; problem: null } | { embed: null; problem: ItchEmbedProblem };

const refused = (problem: ItchEmbedProblem): Parsed => ({ embed: null, problem });

function urlOf(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const isPlainHttps = (u: URL): boolean =>
  u.protocol === "https:" && u.username === "" && u.password === "" && u.port === "";

const GAME_HOST = /^(?!www\.)[a-z0-9-]+\.itch\.io$/;
const GAME_PATH = /^\/[^/]+\/?$/;

const isGamePage = (u: URL): boolean =>
  isPlainHttps(u) && GAME_HOST.test(u.hostname) && GAME_PATH.test(u.pathname);

function attribute(pattern: RegExp, text: string): string | null {
  const m = pattern.exec(text);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

export function gamePageOf(href: string | null): string | null {
  const u = href ? urlOf(href.trim()) : null;
  return u && isGamePage(u) ? `${u.origin}${u.pathname}` : null;
}

function parseAddress(raw: string, page: string | null): Parsed {
  const u = urlOf(raw);
  if (!u) return refused("not-itch");
  if (isGamePage(u)) return refused("page-url");
  if (!isPlainHttps(u) || u.hostname !== ITCH_HOST) return refused("not-itch");
  const uploadId = UPLOAD_PATH.exec(u.pathname)?.[1];
  if (!uploadId) return refused("upload-missing");
  const rawColor = u.searchParams.get("color");
  const color = rawColor && COLOR.test(rawColor) ? rawColor : null;
  const url = `https://${ITCH_HOST}/embed-upload/${uploadId}${color ? `?color=${color}` : ""}`;
  return { embed: { uploadId, url, color, page }, problem: null };
}

function parse(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === "") return refused("empty");
  if (!IFRAME.test(trimmed)) return parseAddress(trimmed, null);
  const src = attribute(SRC, trimmed);
  if (!src) return refused("not-itch");
  return parseAddress(src.trim(), gamePageOf(attribute(HREF, trimmed)));
}

export const parseItchEmbed = (text: string): ItchEmbed | null => parse(text).embed;

export const itchEmbedProblem = (text: string): ItchEmbedProblem | null => parse(text).problem;

export function gameTitleOf(page: string | null): string | null {
  const u = page ? urlOf(page) : null;
  const slug = u?.pathname.split("/").filter(Boolean).at(-1);
  if (!slug) return null;
  const words = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : null;
}
