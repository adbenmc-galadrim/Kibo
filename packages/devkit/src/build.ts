import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ComponentManifest, KiboError } from "@kibo/schema";
import type { Target } from "bun";
import { type BuildMode, type BuildStage, resolver, stageSources } from "./build-resolve";
import { readSources } from "./hash";
import { compileCss } from "./tailwind";
import { type Toolchain, toolchainModules } from "./toolchain";

export type BuildFile = "ui.sandbox.js" | "ui.trusted.js" | "ui.css" | "server.js" | "migrations.js";
export type BuildOutput = { manifest: ComponentManifest; files: Partial<Record<BuildFile, Uint8Array>> };

const SERVER_ENTRIES: [string, BuildFile][] = [
  ["server.ts", "server.js"],
  ["migrations.ts", "migrations.js"],
];

async function bundle(entry: string, mode: BuildMode, stage: BuildStage): Promise<Uint8Array> {
  const target: Target = "browser";
  const format: "cjs" | "esm" = mode === "server" ? "cjs" : "esm";
  const config = {
    entrypoints: [entry],
    target,
    format,
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [resolver(stage, mode)],
    throw: false,
    macros: false,
  };
  const result = await Bun.build(config);
  const [output] = result.outputs;
  if (!result.success || !output) {
    const message = result.logs.map((l) => l.message).join("\n");
    throw new KiboError("VALIDATION_FAILED", message || `build failed for ${entry}`);
  }
  return new Uint8Array(await output.arrayBuffer());
}

export async function componentCss(srcDir: string, toolchain: Toolchain): Promise<string> {
  const sdk = join(toolchain.root, "node_modules", "@kibo", "sdk", "src");
  return compileCss({
    css: [
      '@import "tailwindcss";',
      '@import "tw-animate-css";',
      '@import "shadcn/tailwind.css";',
      '@import "./node_modules/@kibo/sdk/src/theme.css";',
    ].join("\n"),
    sources: [srcDir, sdk],
    toolchain,
  });
}

async function prepareStage(srcDir: string, stage: BuildStage): Promise<ComponentManifest> {
  const sources = stageSources(stage);
  const { files } = await readSources(srcDir);
  for (const file of files) {
    await mkdir(dirname(join(sources, file.path)), { recursive: true });
    await writeFile(join(sources, file.path), file.bytes);
  }
  await symlink(toolchainModules(stage.toolchain), join(stage.root, "node_modules"), "dir");
  const ui = JSON.stringify(join(sources, "ui.tsx"));
  const json = JSON.stringify(join(sources, "kibo.component.json"));
  await writeFile(
    join(stage.root, "sandbox.tsx"),
    `import { mountSandboxed } from "@kibo/sdk/sandbox";\nimport manifest from ${json};\nimport { Component } from ${ui};\nmountSandboxed(manifest, Component);\n`,
  );
  await writeFile(
    join(stage.root, "trusted.tsx"),
    `import manifestJson from ${json};\nexport { Component } from ${ui};\nexport const manifest = manifestJson;\n`,
  );
  const manifest = files.find((f) => f.path === "kibo.component.json");
  const parsed = ComponentManifest.safeParse(JSON.parse(new TextDecoder().decode(manifest?.bytes)));
  if (!parsed.success) throw new KiboError("VALIDATION_FAILED", parsed.error.message);
  return parsed.data;
}

export async function buildComponent(srcDir: string, toolchain: Toolchain): Promise<BuildOutput> {
  const stage = { root: await realpath(await mkdtemp(join(tmpdir(), "kibo-build-"))), toolchain };
  try {
    const manifest = await prepareStage(srcDir, stage);
    const sources = stageSources(stage);
    const files: BuildOutput["files"] = {
      "ui.sandbox.js": await bundle(join(stage.root, "sandbox.tsx"), "sandbox", stage),
      "ui.trusted.js": await bundle(join(stage.root, "trusted.tsx"), "trusted", stage),
      "ui.css": new TextEncoder().encode(await componentCss(srcDir, toolchain)),
    };
    for (const [name, file] of SERVER_ENTRIES) {
      if (existsSync(join(sources, name))) files[file] = await bundle(join(sources, name), "server", stage);
    }
    return { manifest, files };
  } finally {
    await rm(stage.root, { recursive: true, force: true });
  }
}
