import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dir, "../../..");
const { values } = parseArgs({ options: { out: { type: "string" } } });

function hostTriple(): string {
  const rustc = Bun.spawnSync(["rustc", "-vV"]).stdout.toString();
  const triple = /host: (\S+)/.exec(rustc)?.[1];
  if (!triple) throw new Error("cannot read the Rust host triple from `rustc -vV`");
  return triple;
}

const loro = {
  name: "loro-bundler-build",
  setup(build: Bun.PluginBuilder) {
    build.onResolve({ filter: /^loro-crdt$/ }, (args) => ({
      path: Bun.resolveSync("loro-crdt/bundler", args.importer),
    }));
  },
};

async function compile(entrypoints: string[], outfile: string): Promise<void> {
  mkdirSync(dirname(outfile), { recursive: true });
  const result = await Bun.build({
    entrypoints: entrypoints.map((e) => join(root, e)),
    compile: { outfile, autoloadPackageJson: true, autoloadBunfig: false, autoloadDotenv: false },
    plugins: [loro],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`sidecar: ${outfile}`);
}

const daemonEntries = ["apps/desktop/sidecar/entry.ts", "apps/desktop/sidecar/component-worker.ts"];
const hookEntry = "packages/daemon/src/agents/kibo-hook.ts";

if (values.out) {
  await compile(daemonEntries, resolve(values.out));
  await compile([hookEntry], join(dirname(resolve(values.out)), "kibo-hook"));
} else {
  const outDir = join(root, "apps/desktop/src-tauri/binaries");
  const triple = hostTriple();
  await compile(daemonEntries, join(outDir, `kibo-daemon-${triple}`));
  await compile([hookEntry], join(outDir, `kibo-hook-${triple}`));
}
