import { resolve } from "node:path";
import { build, type Rollup } from "vite";
import { type BuiltChunk, reportEntry } from "./bundle-report";

const root = resolve(import.meta.dir, "..");
const result = await build({
  root,
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "warn",
  build: { write: false },
});
const outputs: Rollup.RollupOutput[] = Array.isArray(result) ? result : "output" in result ? [result] : [];
if (outputs.length === 0) throw new Error("vite build returned a watcher");
const chunks: BuiltChunk[] = outputs.flatMap((o) =>
  o.output.flatMap((c) =>
    c.type === "chunk"
      ? [
          {
            fileName: c.fileName,
            isEntry: c.isEntry,
            imports: c.imports,
            code: c.code,
            moduleIds: Object.keys(c.modules),
          },
        ]
      : [],
  ),
);
const report = reportEntry(chunks);
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
console.log(`Chargement initial : ${report.files.join(", ")}`);
console.log(`gzip : ${kb(report.gzipBytes)} (budget ${kb(report.budget)})`);
for (const f of report.forbidden)
  console.error(`Module interdit au chargement initial : ${f.module} (${f.file})`);
if (!report.ok) process.exit(1);
