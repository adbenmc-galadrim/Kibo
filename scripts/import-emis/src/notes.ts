import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { KiboError } from "@kibo/schema";
import { z } from "zod";
import type { DesiredNote } from "./desired";
import type { Change } from "./reconcile";

export const HASH_FILE = ".import-emis.json";
const Hashes = z.record(z.string(), z.string());
type Hashes = z.infer<typeof Hashes>;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function readHashes(dir: string): Hashes {
  const file = join(dir, HASH_FILE);
  return existsSync(file) ? Hashes.parse(JSON.parse(readFileSync(file, "utf8"))) : {};
}

export function withTicketKeys(content: string, keys: ReadonlyMap<string, string>): string {
  return content.replace(/^tickets: \[(.*)\]$/m, (_line, list: string) => {
    const tickets = list.split(",").map((t) => t.trim());
    return `tickets: [${tickets.map((t) => keys.get(t) ?? t).join(", ")}]`;
  });
}

function target(dir: string, path: string): string {
  const root = resolve(dir);
  const file = resolve(root, path);
  if (!file.startsWith(`${root}${sep}`))
    throw new KiboError("INVALID_INPUT", `note ${path} is outside ${dir}`);
  return file;
}

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export function writeNotes(
  dir: string,
  notes: readonly DesiredNote[],
  keys: ReadonlyMap<string, string>,
  options: { dryRun?: boolean } = {},
): Change[] {
  const hashes = readHashes(dir);
  const changes = notes.map((note): Change => {
    const file = target(dir, note.path);
    const what = `note ${note.path}`;
    const content = withTicketKeys(note.content, keys);
    const fresh = sha256(content);
    const save = (kind: "created" | "updated"): Change => {
      if (!options.dryRun) write(file, content);
      hashes[note.path] = fresh;
      return { kind, what, detail: "" };
    };
    if (!existsSync(file)) return save("created");
    const current = readFileSync(file, "utf8");
    if (current === content) {
      hashes[note.path] = fresh;
      return { kind: "kept", what, detail: "" };
    }
    if (hashes[note.path] === sha256(current)) return save("updated");
    return { kind: "drift", what, detail: "edited since the last import" };
  });
  if (!options.dryRun) write(join(dir, HASH_FILE), `${JSON.stringify(hashes, null, 2)}\n`);
  return changes;
}
