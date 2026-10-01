import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { checkImports } from "./imports";
import { inferPermissions } from "./infer-permissions";
import { SourceIssue } from "./issues";
import { typecheckComponent } from "./typecheck";
import { loadTypeScript } from "./typescript";

export const StaticCheck = z.object({
  imports: z.array(SourceIssue),
  typecheck: z.array(z.string()),
  inference: z.object({ used: z.array(z.string()), issues: z.array(SourceIssue) }),
});
export type StaticCheck = z.infer<typeof StaticCheck>;

export async function staticCheck(root: string, copy: string, files: string[]): Promise<StaticCheck> {
  const toolchain = { root };
  const ts = await loadTypeScript(toolchain);
  const checked = files.filter((f) => /\.(tsx?|css)$/.test(f));
  const texts = await Promise.all(
    checked.map(async (path) => ({ path, text: await readFile(join(copy, path), "utf8") })),
  );
  return {
    imports: checkImports(ts, texts),
    typecheck: typecheckComponent(ts, copy, files, toolchain),
    inference: await inferPermissions(copy, toolchain),
  };
}
