import { resolve } from "node:path";
import { build, type Rollup } from "vite";

export const PHONE_ENTRY_GZIP_BUDGET = 260_000;

type Output = Rollup.OutputChunk | Rollup.OutputAsset;

const root = resolve(import.meta.dir, "..");
const result = await build({
  root,
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "warn",
  build: { write: false },
});
const outputs: Rollup.RollupOutput[] = Array.isArray(result) ? result : "output" in result ? [result] : [];
if (outputs.length === 0) throw new Error("vite build returned a watcher");
const files = new Map<string, Output>(outputs.flatMap((o) => o.output.map((f) => [f.fileName, f] as const)));
const entry = [...files.values()].find(
  (f): f is Rollup.OutputChunk =>
    f.type === "chunk" && f.isEntry && f.facadeModuleId?.endsWith("index.html") === true,
);
if (!entry) throw new Error("no index.html entry in the phone build");

const loaded = new Set<string>();
const visit = (chunk: Rollup.OutputChunk) => {
  if (loaded.has(chunk.fileName)) return;
  loaded.add(chunk.fileName);
  for (const css of chunk.viteMetadata?.importedCss ?? []) loaded.add(css);
  for (const name of chunk.imports) {
    const next = files.get(name);
    if (next?.type === "chunk") visit(next);
  }
};
visit(entry);

const bytesOf = (file: Output) =>
  file.type === "chunk"
    ? file.code
    : typeof file.source === "string"
      ? file.source
      : new Uint8Array(file.source);
const gzipBytes = [...loaded].reduce((sum, name) => {
  const file = files.get(name);
  return file ? sum + Bun.gzipSync(bytesOf(file)).byteLength : sum;
}, 0);
const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB (${bytes} octets)`;
console.log(`Chargement initial du téléphone : ${[...loaded].join(", ")}`);
console.log(`gzip : ${kb(gzipBytes)}, plafond : ${kb(PHONE_ENTRY_GZIP_BUDGET)}`);
if (gzipBytes > PHONE_ENTRY_GZIP_BUDGET) process.exit(1);
