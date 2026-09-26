import { join } from "node:path";
import { FR_DEVKIT } from "./fr";
import type { Toolchain } from "./toolchain";
import type { TypeScript } from "./typescript";

export function typecheckComponent(
  ts: TypeScript,
  dir: string,
  files: string[],
  toolchain: Toolchain,
): string[] {
  const program = ts.createProgram({
    rootNames: files.filter((f) => /\.tsx?$/.test(f)).map((f) => join(dir, f)),
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      resolveJsonModule: true,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      types: ["bun"],
      typeRoots: [join(toolchain.root, "node_modules", "@types")],
    },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file || d.start === undefined) return text;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return FR_DEVKIT.typeError(d.file.fileName.slice(dir.length + 1), line + 1, text);
  });
}
