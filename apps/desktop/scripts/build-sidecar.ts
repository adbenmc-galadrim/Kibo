import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const rustc = Bun.spawnSync(["rustc", "-vV"]).stdout.toString();
const triple = /host: (\S+)/.exec(rustc)?.[1];
if (!triple) throw new Error("cannot read the Rust host triple from `rustc -vV`");
const outDir = join(root, "apps/desktop/src-tauri/binaries");
mkdirSync(outDir, { recursive: true });
const loro = {
  name: "loro-bundler-build",
  setup(build: Bun.PluginBuilder) {
    build.onResolve({ filter: /^loro-crdt$/ }, (args) => ({
      path: Bun.resolveSync("loro-crdt/bundler", args.importer),
    }));
  },
};
const targets = [
  ["kibo-daemon", "packages/daemon/src/main.ts"],
  ["kibo-hook", "packages/daemon/src/agents/kibo-hook.ts"],
] as const;
for (const [name, entry] of targets) {
  const out = join(outDir, `${name}-${triple}`);
  const result = await Bun.build({
    entrypoints: [join(root, entry)],
    compile: { outfile: out },
    plugins: [loro],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`sidecar: ${out}`);
}
