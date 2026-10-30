import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readAppVersion } from "@kibo/devkit";

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

function appVersionOfTauriConf(): string {
  return readAppVersion(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
}

type Binary = { entrypoints: string[]; define?: Record<string, string> };

async function compile({ entrypoints, define }: Binary, outfile: string): Promise<void> {
  mkdirSync(dirname(outfile), { recursive: true });
  const result = await Bun.build({
    entrypoints: entrypoints.map((e) => join(root, e)),
    compile: { outfile, autoloadPackageJson: false, autoloadBunfig: false, autoloadDotenv: false },
    plugins: [loro],
    ...(define && { define }),
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`sidecar: ${outfile}`);
}

const daemon: Binary = {
  entrypoints: ["apps/desktop/sidecar/entry.ts"],
  define: { "process.env.KIBO_VERSION": JSON.stringify(appVersionOfTauriConf()) },
};
const hook: Binary = { entrypoints: ["packages/daemon/src/runs/kibo-hook.ts"] };

if (values.out) {
  await compile(daemon, resolve(values.out));
  await compile(hook, join(dirname(resolve(values.out)), "kibo-hook"));
} else {
  const outDir = join(root, "apps/desktop/src-tauri/binaries");
  const triple = hostTriple();
  await compile(daemon, join(outDir, `kibo-daemon-${triple}`));
  await compile(hook, join(outDir, `kibo-hook-${triple}`));
}
