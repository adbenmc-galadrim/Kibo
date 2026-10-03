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

export const StaticCheckStep = StaticCheck.partial();
export type StaticCheckStep = z.infer<typeof StaticCheckStep>;

export async function staticCheck(
  root: string,
  copy: string,
  files: string[],
  emit: (step: StaticCheckStep) => void = () => {},
): Promise<StaticCheck> {
  const toolchain = { root };
  const ts = await loadTypeScript(toolchain);
  const checked = files.filter((f) => /\.(tsx?|css)$/.test(f));
  const texts = await Promise.all(
    checked.map(async (path) => ({ path, text: await readFile(join(copy, path), "utf8") })),
  );
  const imports = checkImports(ts, texts);
  emit({ imports });
  const typecheck = typecheckComponent(ts, copy, files, toolchain);
  emit({ typecheck });
  const inference = await inferPermissions(copy, toolchain);
  emit({ inference });
  return { imports, typecheck, inference };
}
