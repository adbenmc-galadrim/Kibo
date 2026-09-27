export type Parsed = { positional: string[]; flags: Record<string, string | true> };

const VALUED = new Set(["kind", "port", "to", "publisher", "out", "dir", "key", "id", "name", "verify"]);

export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && VALUED.has(name)) {
      flags[name] = next;
      i += 1;
    } else flags[name] = true;
  }
  return { positional, flags };
}
