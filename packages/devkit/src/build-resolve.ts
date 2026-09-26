import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { KiboError, SERVER_SPECIFIERS, SHARED_SPECIFIERS } from "@kibo/schema";
import type { BunPlugin } from "bun";
import type { Toolchain } from "./toolchain";

export type BuildMode = "sandbox" | "trusted" | "server";
export type BuildStage = { root: string; toolchain: Toolchain };

const IDENT = /^[A-Za-z_$][\w$]*$/;
const EMBEDDED = new Set(["lucide-react", "@kibo/sdk/sandbox"]);
const BROWSER_SPECIFIERS = [...SHARED_SPECIFIERS, "react/jsx-dev-runtime"];
const SHARED_IN_TRUSTED = new Set(BROWSER_SPECIFIERS.filter((spec) => !EMBEDDED.has(spec)));

export const stageSources = (stage: BuildStage): string => join(stage.root, "src");

const inside = (path: string, dir: string): boolean => {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

async function sharedShim(spec: string, toolchain: Toolchain): Promise<string> {
  const mod: Record<string, unknown> = await import(Bun.resolveSync(spec, toolchain.root));
  const names = Object.keys(mod).filter((n) => n !== "default" && IDENT.test(n));
  return [
    `const m = globalThis.__kiboShared[${JSON.stringify(spec)}];`,
    "export default m.default ?? m;",
    ...names.map((n) => `export const ${n} = m.${n};`),
  ].join("\n");
}

export function resolver(stage: BuildStage, mode: BuildMode): BunPlugin {
  const sources = stageSources(stage);
  const allowed = new Set(
    mode === "server" ? SERVER_SPECIFIERS : [...BROWSER_SPECIFIERS, "@kibo/sdk/sandbox"],
  );
  const fromComponent = (importer: string): boolean =>
    dirname(importer) === stage.root || inside(importer, sources);
  return {
    name: "kibo-resolve",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const spec = args.path;
        if (mode === "trusted" && SHARED_IN_TRUSTED.has(spec))
          return { path: spec, namespace: "kibo-shared" };
        if (args.importer === "" || !fromComponent(args.importer)) return undefined;
        if (spec.startsWith(".") || isAbsolute(spec)) {
          const target = isAbsolute(spec) ? spec : resolve(dirname(args.importer), spec);
          if (!inside(target, sources))
            throw new KiboError("VALIDATION_FAILED", `import outside the component: ${spec}`);
          return undefined;
        }
        if (!allowed.has(spec)) throw new KiboError("VALIDATION_FAILED", `forbidden import: ${spec}`);
        return undefined;
      });
      build.onLoad({ filter: /.*/, namespace: "kibo-shared" }, async (args) => ({
        contents: await sharedShim(args.path, stage.toolchain),
        loader: "js",
      }));
    },
  };
}
