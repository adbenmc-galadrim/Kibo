import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const rustc = Bun.spawnSync(["rustc", "-vV"]).stdout.toString();
const triple = /host: (\S+)/.exec(rustc)?.[1];
if (!triple) throw new Error("cannot read the Rust host triple from `rustc -vV`");
const outDir = join(root, "apps/desktop/src-tauri/binaries");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `kibo-daemon-${triple}`);
const result = await Bun.build({
  entrypoints: [join(root, "packages/daemon/src/main.ts")],
  compile: { outfile: out },
  plugins: [
    {
      name: "loro-bundler-build",
      setup(build) {
        build.onResolve({ filter: /^loro-crdt$/ }, (args) => ({
          path: Bun.resolveSync("loro-crdt/bundler", args.importer),
        }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
console.log(`sidecar: ${out}`);
