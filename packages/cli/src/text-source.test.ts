import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { readTextArg } from "./text-source";

const dir = mkdtempSync(join(tmpdir(), "kibo-text-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("readTextArg", () => {
  test("@- reads the standard input", () => {
    expect(readTextArg("@-", dir, () => "depuis stdin")).toBe("depuis stdin");
  });

  test("@path reads a file relative to cwd", () => {
    mkdirSync(join(dir, "notes"), { recursive: true });
    writeFileSync(join(dir, "notes", "silo.md"), "Tournée **dépôt**\n");
    expect(readTextArg("@notes/silo.md", dir, () => "jamais")).toBe("Tournée **dépôt**\n");
  });

  test("a plain text is returned as is", () => {
    expect(readTextArg("Saisie hors ligne", dir, () => "jamais")).toBe("Saisie hors ligne");
  });

  test("a missing file is NOT_FOUND", () => {
    const read = () => readTextArg("@absent.md", dir);
    expect(read).toThrow(KiboError);
    expect(read).toThrow("file not found: absent.md");
  });
});
