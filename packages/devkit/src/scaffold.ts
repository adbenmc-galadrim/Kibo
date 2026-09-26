import { existsSync } from "node:fs";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ComponentManifest, isBuiltinId, KiboError } from "@kibo/schema";
import { type Toolchain, toolchainModules } from "./toolchain";

export type ScaffoldOptions = {
  root: string;
  id: string;
  kind: "widget" | "view" | "both";
  server: boolean;
  toolchain: Toolchain;
};

const titleOf = (id: string) => {
  const words = (id.split(".").at(-1) ?? id).split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const UI = (title: string) => `import { useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>${title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{sdk.surface === "view" ? "Vue" : "Widget"}</CardContent>
    </Card>
  );
}
`;

const SERVER = `import { defineServer } from "@kibo/sdk/server";

export const server = defineServer({
  actions: {
    ping: async () => "pong",
  },
});
`;

const TEST = `import { runConformance } from "@kibo/sdk/conformance";
import manifest from "./kibo.component.json";
import { Component } from "./ui";

runConformance({ manifest, Component });
`;

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    lib: ["ES2022", "DOM"],
    types: ["bun"],
  },
  include: ["**/*.ts", "**/*.tsx", "kibo.component.json"],
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export async function scaffold(opts: ScaffoldOptions): Promise<string> {
  const dir = join(opts.root, opts.id);
  const title = titleOf(opts.id);
  const manifest = {
    id: opts.id,
    version: "0.1.0",
    kind: opts.kind,
    title,
    description: `${title} : à décrire`,
    reads: [],
    writes: [],
    changes: [],
  };
  if (!ComponentManifest.safeParse(manifest).success) {
    throw new KiboError("INVALID_INPUT", `invalid component id ${opts.id}`);
  }
  if (isBuiltinId(opts.id)) throw new KiboError("INVALID_INPUT", `${opts.id} is a built-in component`);
  if (existsSync(dir)) throw new KiboError("INVALID_INPUT", `${dir} already exists`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, "kibo.component.json"), json(manifest));
  await writeFile(join(dir, "ui.tsx"), UI(title));
  if (opts.server) await writeFile(join(dir, "server.ts"), SERVER);
  await writeFile(join(dir, "component.test.tsx"), TEST);
  await writeFile(join(dir, "tsconfig.json"), json(TSCONFIG));
  await symlink(toolchainModules(opts.toolchain), join(dir, "node_modules"), "dir");
  return dir;
}
