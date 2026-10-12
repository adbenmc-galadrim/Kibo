import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { isInside } from "../code/safe-path";

export type InstalledPlugin = { name: string; marketplace: string; version: string; installPath: string };

const PLUGIN_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const INDEX_FILE = "installed_plugins.json";

const InstalledPlugins = z.object({
  plugins: z.record(
    z.string(),
    z.array(z.object({ installPath: z.string().min(1), version: z.string().default("") }).passthrough()),
  ),
});

const isMissing = (e: unknown): boolean => e instanceof Error && "code" in e && e.code === "ENOENT";
const log = (message: string, e?: unknown) =>
  console.error(`[kibo-daemon] plugins: ${message}`, ...(e === undefined ? [] : [e]));

async function readIndex(pluginsRoot: string): Promise<z.infer<typeof InstalledPlugins> | null> {
  let text: string;
  try {
    text = await readFile(join(pluginsRoot, INDEX_FILE), "utf8");
  } catch (e) {
    if (!isMissing(e)) log(`cannot read ${INDEX_FILE}`, e);
    return null;
  }
  try {
    const parsed = InstalledPlugins.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
    log(`${INDEX_FILE} has an unknown shape`, parsed.error.message);
  } catch (e) {
    log(`${INDEX_FILE} is not JSON`, e);
  }
  return null;
}

async function realOrNull(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

async function pluginOf(
  root: string,
  key: string,
  entries: readonly { installPath: string; version: string }[],
): Promise<InstalledPlugin | null> {
  const at = key.lastIndexOf("@");
  const name = at > 0 ? key.slice(0, at) : "";
  const marketplace = at > 0 ? key.slice(at + 1) : "";
  if (!PLUGIN_NAME.test(name) || marketplace === "") {
    log(`${key} is not a plugin@marketplace key, ignored`);
    return null;
  }
  for (const entry of entries) {
    const real = await realOrNull(entry.installPath);
    if (real !== null && isInside(root, real) && real !== root)
      return { name, marketplace, version: entry.version, installPath: real };
  }
  log(`${key} is installed outside the plugins root, ignored`);
  return null;
}

export async function readInstalledPlugins(pluginsRoot: string): Promise<InstalledPlugin[]> {
  const index = await readIndex(pluginsRoot);
  const root = index === null ? null : await realOrNull(pluginsRoot);
  if (index === null || root === null) return [];
  const plugins: InstalledPlugin[] = [];
  for (const [key, entries] of Object.entries(index.plugins)) {
    const plugin = await pluginOf(root, key, entries);
    if (plugin !== null && !plugins.some((p) => p.name === plugin.name)) plugins.push(plugin);
  }
  return plugins;
}
