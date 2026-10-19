import { afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type ImageFs, nodeImageFs } from "./question-images";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function imagesTmp(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-question-images-")));
  dirs.push(dir);
  return dir;
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export function pngBytes(width: number, height: number, padding = 0): Uint8Array {
  const head = [137, 80, 78, 71, 13, 10, 26, 10, ...u32(13), ...ascii("IHDR"), ...u32(width), ...u32(height)];
  return Uint8Array.from([...head, 8, 6, 0, 0, 0, ...new Array<number>(padding).fill(0)]);
}

export function writeImage(path: string, bytes: Uint8Array = pngBytes(800, 600)): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return path;
}

export function removalFs(fail: Error | null = null): ImageFs & { removed: string[] } {
  const removed: string[] = [];
  return {
    ...nodeImageFs,
    removed,
    remove(dir) {
      if (fail) throw fail;
      removed.push(dir);
    },
  };
}
