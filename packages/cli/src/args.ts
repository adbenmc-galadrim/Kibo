import { KiboError } from "@kibo/schema";

export type FlagValue = string | true | string[];
export type Parsed = { positional: string[]; flags: Record<string, FlagValue> };

const VALUED = new Set([
  "kind",
  "port",
  "to",
  "publisher",
  "out",
  "dir",
  "key",
  "id",
  "name",
  "verify",
  "template",
  "project",
  "status",
  "sprint",
  "tool",
  "home",
  "feature",
  "label",
  "labels",
  "fields",
  "description",
  "append",
  "prepend",
  "title",
  "code",
  "start",
  "end",
  "context",
  "recipient",
  "provisional",
  "option",
  "blocks",
]);

const REPEATED = new Set(["option"]);

function stored(previous: FlagValue | undefined, name: string, value: string): FlagValue {
  if (!REPEATED.has(name)) return value;
  return Array.isArray(previous) ? [...previous, value] : [value];
}

export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && VALUED.has(name)) {
      flags[name] = stored(flags[name], name, next);
      i += 1;
    } else flags[name] = true;
  }
  return { positional, flags };
}

const needsValue = (name: string) => new KiboError("INVALID_INPUT", `--${name} needs a value`);

export function flagText(flags: Parsed["flags"], name: string): string | null {
  const value = flags[name];
  if (value === undefined) return null;
  if (typeof value !== "string") throw needsValue(name);
  return value;
}

export function flagList(flags: Parsed["flags"], name: string): string[] {
  const value = flags[name];
  if (value === undefined) return [];
  if (value === true) throw needsValue(name);
  return typeof value === "string" ? [value] : value;
}

export function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}
