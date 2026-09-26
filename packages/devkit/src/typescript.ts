import type * as TS from "typescript";
import type { Toolchain } from "./toolchain";

export type TypeScript = typeof TS;

export async function loadTypeScript(t: Toolchain): Promise<TypeScript> {
  const ts: TypeScript = await import(Bun.resolveSync("typescript", t.root));
  return ts;
}
