import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readInstalledPlugins } from "./plugins";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function pluginsRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "kibo-plugins-"));
  dirs.push(root);
  return root;
}

test("an installed plugin under the plugins root is read, one outside is ignored and logged", async () => {
  const root = pluginsRoot();
  const installPath = join(root, "cache", "official", "superpowers", "6.4.1");
  mkdirSync(installPath, { recursive: true });
  const index = {
    version: 2,
    plugins: {
      "superpowers@official": [{ scope: "user", installPath, version: "6.4.1" }],
      "evil@x": [{ installPath: "/etc" }],
    },
  };
  writeFileSync(join(root, "installed_plugins.json"), JSON.stringify(index));
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const plugins = await readInstalledPlugins(root);
    expect(plugins).toEqual([
      { name: "superpowers", marketplace: "official", version: "6.4.1", installPath: expect.any(String) },
    ]);
    expect(plugins[0]?.installPath.endsWith(join("superpowers", "6.4.1"))).toBe(true);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0]?.[0])).toContain("evil@x");
  } finally {
    errors.mockRestore();
  }
});

test("a missing index gives no plugin", async () => {
  expect(await readInstalledPlugins(pluginsRoot())).toEqual([]);
});

test("an invalid index gives no plugin and is logged", async () => {
  const root = pluginsRoot();
  writeFileSync(join(root, "installed_plugins.json"), "{ not json");
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await readInstalledPlugins(root)).toEqual([]);
    writeFileSync(join(root, "installed_plugins.json"), JSON.stringify({ plugins: [1, 2] }));
    expect(await readInstalledPlugins(root)).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(2);
  } finally {
    errors.mockRestore();
  }
});

test("a key without marketplace or with an invalid name is ignored", async () => {
  const root = pluginsRoot();
  const installPath = join(root, "cache", "m", "p", "1");
  mkdirSync(installPath, { recursive: true });
  const index = { plugins: { nomarket: [{ installPath }], "Bad Name@m": [{ installPath }] } };
  writeFileSync(join(root, "installed_plugins.json"), JSON.stringify(index));
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await readInstalledPlugins(root)).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
