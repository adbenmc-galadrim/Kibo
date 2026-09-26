export type Redactor = { add(secret: string): void; redact(text: string): string };

const MIN_SECRET_LENGTH = 8;
const METHODS = ["log", "info", "warn", "error", "debug"] as const;
type ConsoleLike = Record<(typeof METHODS)[number], (...args: unknown[]) => void>;

export function createRedactor(): Redactor {
  const secrets = new Set<string>();
  return {
    add(secret) {
      if (secret.length >= MIN_SECRET_LENGTH) secrets.add(secret);
    },
    redact(text) {
      let out = text;
      for (const s of [...secrets].sort((a, b) => b.length - a.length)) out = out.split(s).join("***");
      return out;
    },
  };
}

function render(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (e) {
    return `[unserializable: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

export function installConsoleRedaction(r: Redactor, target: ConsoleLike = console): () => void {
  const originals = METHODS.map((m) => target[m]);
  for (const m of METHODS) {
    const original = target[m].bind(target);
    target[m] = (...args: unknown[]) => original(...args.map((a) => r.redact(render(a))));
  }
  return () => {
    METHODS.forEach((m, i) => {
      const original = originals[i];
      if (original) target[m] = original;
    });
  };
}
