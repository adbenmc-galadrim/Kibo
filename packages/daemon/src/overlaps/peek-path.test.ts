import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DUPLICATION_LIMITS } from "@kibo/schema";
import { cleanupTmp, tmp } from "../testing/git-test-kit";
import { localPeekFs, screenOf } from "./peek-fakes.test-helper";
import { readPeekFile, resolvePeekPath } from "./peek-path";

afterEach(cleanupTmp);

function space() {
  const root = realpathSync(tmp());
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  return root;
}

const refusedWith = (fn: () => unknown, reason: string) => {
  expect(fn).toThrow(reason);
  try {
    fn();
  } catch (e) {
    expect(e).toMatchObject({ code: "INVALID_INPUT" });
  }
};

describe("resolvePeekPath", () => {
  test("a relative path resolves under the workspace", () => {
    const root = space();
    expect(resolvePeekPath(root, "src/a.ts", screenOf())).toBe(join(root, "src", "a.ts"));
  });

  test("paths leaving the workspace are refused", () => {
    const root = space();
    for (const path of ["../x", "/etc/passwd", "src/../../x", ".git/config"]) {
      refusedWith(() => resolvePeekPath(root, path, screenOf()), "hors de l'espace de travail");
    }
  });

  test("a symbolic link is refused, inside or outside", () => {
    const root = space();
    const outside = tmp();
    writeFileSync(join(outside, "secret.txt"), "x");
    symlinkSync(join(outside, "secret.txt"), join(root, "src", "out.txt"));
    symlinkSync(join(root, "src", "a.ts"), join(root, "src", "in.ts"));
    refusedWith(() => resolvePeekPath(root, "src/out.txt", screenOf()), "lien symbolique");
    refusedWith(() => resolvePeekPath(root, "src/in.ts", screenOf()), "lien symbolique");
  });

  test("secret and ignored files are refused with their reason", () => {
    const root = space();
    const screen = screenOf({
      ".env": "secret",
      "keys/a.pem": "secret",
      "node_modules/x.js": "ignored",
      "dist/a.js": "ignored",
    });
    refusedWith(() => resolvePeekPath(root, ".env", screen), "fichier secret");
    refusedWith(() => resolvePeekPath(root, "keys/a.pem", screen), "fichier secret");
    refusedWith(() => resolvePeekPath(root, "node_modules/x.js", screen), "fichier ignoré");
    refusedWith(() => resolvePeekPath(root, "dist/a.js", screen), "fichier ignoré");
  });
});

describe("readPeekFile", () => {
  test("a text file is read whole", async () => {
    const root = space();
    expect(await readPeekFile(localPeekFs, join(root, "src", "a.ts"), "src/a.ts")).toBe(
      "export const a = 1;\n",
    );
  });

  test("a missing file reads as null", async () => {
    const root = space();
    expect(await readPeekFile(localPeekFs, join(root, "src", "gone.ts"), "src/gone.ts")).toBeNull();
  });

  test("a binary file is refused", async () => {
    const root = space();
    writeFileSync(join(root, "src", "b.ts"), Buffer.from([0x61, 0x00, 0x62]));
    await expect(readPeekFile(localPeekFs, join(root, "src", "b.ts"), "src/b.ts")).rejects.toThrow(
      "fichier binaire",
    );
  });

  test("a file over 256 KiB is refused", async () => {
    const root = space();
    writeFileSync(join(root, "src", "big.ts"), "a".repeat(DUPLICATION_LIMITS.peekContentBytes + 1));
    writeFileSync(join(root, "src", "edge.ts"), "a".repeat(DUPLICATION_LIMITS.peekContentBytes));
    await expect(readPeekFile(localPeekFs, join(root, "src", "big.ts"), "src/big.ts")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(readPeekFile(localPeekFs, join(root, "src", "big.ts"), "src/big.ts")).rejects.toThrow(
      "fichier trop grand",
    );
    expect((await readPeekFile(localPeekFs, join(root, "src", "edge.ts"), "src/edge.ts"))?.length).toBe(
      DUPLICATION_LIMITS.peekContentBytes,
    );
  });
});
