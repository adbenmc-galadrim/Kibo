import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, "kibo-sync");
const result = await Bun.build({
  entrypoints: [join(root, "src/cli.ts")],
  compile: { outfile, autoloadPackageJson: false, autoloadBunfig: false, autoloadDotenv: false },
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
console.log(`kibo-sync: ${outfile}`);
