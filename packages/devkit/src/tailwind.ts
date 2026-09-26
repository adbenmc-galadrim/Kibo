import type { Toolchain } from "./toolchain";

type TailwindCompiler = { build(candidates: string[]): string };
type TailwindNode = {
  compile(
    css: string,
    opts: { base: string; onDependency: (path: string) => void },
  ): Promise<TailwindCompiler>;
};
type OxideScanner = { scan(): string[] };
type Oxide = {
  Scanner: new (opts: { sources: { base: string; pattern: string; negated: boolean }[] }) => OxideScanner;
};

async function loadTailwind(t: Toolchain): Promise<{ node: TailwindNode; oxide: Oxide }> {
  const node: TailwindNode = await import(Bun.resolveSync("@tailwindcss/node", t.root));
  const oxide: Oxide = await import(Bun.resolveSync("@tailwindcss/oxide", t.root));
  return { node, oxide };
}

export async function compileCss(input: {
  css: string;
  sources: string[];
  toolchain: Toolchain;
}): Promise<string> {
  const { node, oxide } = await loadTailwind(input.toolchain);
  const compiler = await node.compile(input.css, { base: input.toolchain.root, onDependency: () => {} });
  const scanner = new oxide.Scanner({
    sources: input.sources.map((base) => ({ base, pattern: "**/*", negated: false })),
  });
  return compiler.build(scanner.scan());
}
