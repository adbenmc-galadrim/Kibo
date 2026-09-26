import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ComponentManifest, KiboError } from "@kibo/schema";

export type BuiltinBackend = { manifest: ComponentManifest; server: string };

const MANIFEST = "kibo.component.json";
const SERVER = "server.js";

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT")
      throw new KiboError("NOT_FOUND", `builtin backend file missing: ${path}`);
    throw e;
  }
}

async function readManifest(dir: string): Promise<ComponentManifest> {
  const parsed = ComponentManifest.safeParse(JSON.parse(await readText(join(dir, MANIFEST))));
  if (!parsed.success) throw new KiboError("VALIDATION_FAILED", `${dir}: ${parsed.error.message}`);
  return parsed.data;
}

export async function buildBuiltinBackend(componentDir: string): Promise<BuiltinBackend> {
  const manifest = await readManifest(componentDir);
  const config = {
    entrypoints: [join(componentDir, "src", "server.ts")],
    target: "browser" as const,
    format: "cjs" as const,
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    throw: false,
    macros: false,
  };
  const result = await Bun.build(config);
  const [output] = result.outputs;
  if (!result.success || !output) {
    const message = result.logs.map((l) => l.message).join("\n");
    throw new KiboError("VALIDATION_FAILED", message || `build failed for ${componentDir}`);
  }
  return { manifest, server: await output.text() };
}

export async function readBuiltinBackend(dir: string): Promise<BuiltinBackend> {
  return { manifest: await readManifest(dir), server: await readText(join(dir, SERVER)) };
}

export async function writeBuiltinBackend(b: BuiltinBackend, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, MANIFEST), JSON.stringify(b.manifest));
  await writeFile(join(dir, SERVER), b.server);
}
