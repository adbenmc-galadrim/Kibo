import { beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStatic } from "./static";

const INDEX =
  '<!doctype html><html><head><title>Kibo</title></head><body><div id="root"></div></body></html>';
let serve: (pathname: string) => Response = () => new Response();

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-remote-nonce-"));
  writeFileSync(join(dir, "index.html"), INDEX);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "app.css"), "body{margin:0}");
  serve = createStatic(dir);
});

const styleSrc = (res: Response): string =>
  res.headers
    .get("content-security-policy")
    ?.split("; ")
    .find((d) => d.startsWith("style-src")) ?? "";

const nonceOf = (res: Response): string | null => /'nonce-([^']+)'/.exec(styleSrc(res))?.[1] ?? null;
const metaNonce = (html: string): string | null =>
  /<meta property="csp-nonce" content="([^"]+)">/.exec(html)?.[1] ?? null;

test("index.html carries a fresh style nonce in its CSP, the same one as its meta tag", async () => {
  for (const path of ["/", "/index.html", "/p/silo/kanban"]) {
    const res = serve(path);
    const nonce = nonceOf(res);
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(styleSrc(res)).toBe(`style-src 'self' 'nonce-${nonce}'`);
    const html = await res.text();
    expect(metaNonce(html)).toBe(nonce);
    expect(html).toContain('<title>Kibo</title><meta property="csp-nonce"');
    expect(res.headers.get("content-type")).toContain("text/html");
  }
});

test("every index.html response gets a different nonce", () => {
  const nonces = new Set(Array.from({ length: 20 }, () => nonceOf(serve("/"))));
  expect(nonces.size).toBe(20);
});

test("the CSP never allows inline styles and assets get no nonce", async () => {
  expect(serve("/").headers.get("content-security-policy")).not.toContain("unsafe-inline");
  const css = serve("/assets/app.css");
  expect(styleSrc(css)).toBe("style-src 'self'");
  expect(await css.text()).toBe("body{margin:0}");
});
