import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const FORBIDDEN = [/@kibo\/remote\/crypto/, /pairing-code/, /from\s+["']@kibo\/remote["']/, /remote\/src\//];

describe("the server cannot read", () => {
  test("no source imports the remote crypto, the pairing code or the remote index", async () => {
    const offenders: string[] = [];
    for await (const file of new Bun.Glob("**/*.ts").scan({ cwd: import.meta.dir })) {
      if (file === "no-crypto-import.test.ts") continue;
      const text = await Bun.file(join(import.meta.dir, file)).text();
      for (const pattern of FORBIDDEN) if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  test("the package only depends on the envelope schemas", async () => {
    const pkg = await Bun.file(join(import.meta.dir, "..", "package.json")).json();
    const imports = new Set<string>();
    for await (const file of new Bun.Glob("**/*.ts").scan({ cwd: import.meta.dir })) {
      const text = await Bun.file(join(import.meta.dir, file)).text();
      for (const match of text.matchAll(/from\s+["'](@kibo\/remote[^"']*)["']/g))
        if (match[1]) imports.add(match[1]);
    }
    expect(
      [...imports].every(
        (spec) => spec === "@kibo/remote/protocol" || spec === "@kibo/remote/snapshot-kinds",
      ),
    ).toBe(true);
    expect(Object.keys(pkg.dependencies)).toContain("@kibo/remote");
  });
});
