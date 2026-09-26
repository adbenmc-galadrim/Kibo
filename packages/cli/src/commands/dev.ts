import { rmSync, watch } from "node:fs";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { componentCss, type Toolchain } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

export type DevServer = { url: string; stop(): void };

const RELOAD =
  "let v=null;setInterval(async()=>{const r=await fetch('/version');const t=await r.text();if(v!==null&&t!==v)location.reload();v=t;},500);";

const PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>Kibo · aperçu</title><link rel="stylesheet" href="/app.css"></head>' +
  `<body><div id="root"></div><script type="module" src="/app.js"></script><script>${RELOAD}</script></body></html>`;

const SHARED = /^(react|react-dom|@kibo\/|lucide-react)/;

const entrySource = (dir: string): string =>
  [
    'import { mountDev } from "@kibo/sdk/dev";',
    `import manifest from ${JSON.stringify(join(dir, "kibo.component.json"))};`,
    `import { Component } from ${JSON.stringify(join(dir, "ui.tsx"))};`,
    "mountDev(manifest, Component);",
    "",
  ].join("\n");

const inside = (path: string, dir: string): boolean => {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

type Bundle = { js: string; css: string; failure: string | null; version: number };

async function build(entry: string, dir: string, toolchain: Toolchain, previous: Bundle): Promise<Bundle> {
  const fromPreview = (importer: string) => importer === entry || inside(importer, dir);
  const result = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "esm",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    plugins: [
      {
        name: "kibo-dev-resolve",
        setup(b) {
          b.onResolve({ filter: SHARED }, (args) =>
            fromPreview(args.importer) ? { path: Bun.resolveSync(args.path, toolchain.root) } : undefined,
          );
        },
      },
    ],
    throw: false,
  });
  const [out] = result.outputs;
  const version = previous.version + 1;
  if (!result.success || !out) {
    return { ...previous, failure: result.logs.map((l) => l.message).join("\n"), version };
  }
  return { js: await out.text(), css: await componentCss(dir, toolchain), failure: null, version };
}

const text = (body: string, type: string) =>
  new Response(body, { headers: { "content-type": `${type}; charset=utf-8` } });

export async function startDevServer(
  target: string,
  toolchain: Toolchain,
  opts: { port?: number } = {},
): Promise<DevServer> {
  const dir = await realpath(target).catch((e: unknown) => {
    if (e instanceof Error && "code" in e && e.code === "ENOENT")
      throw new KiboError("NOT_FOUND", `component folder not found: ${target}`);
    throw e;
  });
  const entryDir = await realpath(await mkdtemp(join(tmpdir(), "kibo-dev-")));
  const entry = join(entryDir, "entry.tsx");
  await writeFile(entry, entrySource(dir));
  let bundle = await build(entry, dir, toolchain, { js: "", css: "", failure: null, version: 0 });
  let pending: ReturnType<typeof setTimeout> | null = null;
  const rebuild = () => {
    build(entry, dir, toolchain, bundle).then(
      (next) => {
        bundle = next;
      },
      (e: unknown) => {
        bundle = {
          ...bundle,
          failure: e instanceof Error ? e.message : String(e),
          version: bundle.version + 1,
        };
      },
    );
  };
  const watcher = watch(dir, { recursive: true }, (_event, name) => {
    if (!name || name.startsWith(".") || name.startsWith("node_modules")) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(rebuild, 150);
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/") return text(PAGE, "text/html");
      if (path === "/version") return text(String(bundle.version), "text/plain");
      if (path === "/app.css") return text(bundle.css, "text/css");
      if (path === "/app.js") {
        const failure = bundle.failure;
        return text(
          failure ? `document.body.textContent = ${JSON.stringify(failure)};` : bundle.js,
          "text/javascript",
        );
      }
      return new Response("not found", { status: 404 });
    },
  });
  if (server.port === undefined) throw new KiboError("INTERNAL", "dev server did not bind");
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => {
      if (pending) clearTimeout(pending);
      watcher.close();
      server.stop(true);
      rmSync(entryDir, { recursive: true, force: true });
    },
  };
}
