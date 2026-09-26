import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildBuiltinBackend, writeBuiltinBackend } from "@kibo/devkit";
import { BUILTIN_ADAPTER_IDS } from "@kibo/schema";

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

type Binary = { entrypoints: string[]; loadsToolchain: boolean };

async function compile({ entrypoints, loadsToolchain }: Binary, outfile: string): Promise<void> {
  mkdirSync(dirname(outfile), { recursive: true });
  const result = await Bun.build({
    entrypoints: entrypoints.map((e) => join(root, e)),
    compile: { outfile, autoloadPackageJson: loadsToolchain, autoloadBunfig: false, autoloadDotenv: false },
    plugins: [loro],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`sidecar: ${outfile}`);
}

const daemon: Binary = {
  entrypoints: ["apps/desktop/sidecar/entry.ts", "apps/desktop/sidecar/component-worker.ts"],
  loadsToolchain: true,
};
const hook: Binary = { entrypoints: ["packages/daemon/src/agents/kibo-hook.ts"], loadsToolchain: false };

async function prebuildAdapters(outDir: string): Promise<void> {
  for (const id of BUILTIN_ADAPTER_IDS) {
    await writeBuiltinBackend(await buildBuiltinBackend(join(root, "components", id)), join(outDir, id));
    console.log(`builtin: ${join(outDir, id)}`);
  }
}

if (values.out) {
  await compile(daemon, resolve(values.out));
  await compile(hook, join(dirname(resolve(values.out)), "kibo-hook"));
  await prebuildAdapters(join(dirname(resolve(values.out)), "builtin"));
} else {
  const outDir = join(root, "apps/desktop/src-tauri/binaries");
  const triple = hostTriple();
  await compile(daemon, join(outDir, `kibo-daemon-${triple}`));
  await compile(hook, join(outDir, `kibo-hook-${triple}`));
  await prebuildAdapters(join(root, "apps/desktop/src-tauri/builtin"));
}
