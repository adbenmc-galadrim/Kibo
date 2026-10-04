export type LogBuffer = {
  install(target: Pick<Console, "error" | "warn">): () => void;
  tail(n: number): string[];
};

type Level = "error" | "warn";

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (e) {
    return `[unserializable: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

export function createLogBuffer(capacity = 500): LogBuffer {
  const lines: string[] = [];
  const push = (level: Level, args: unknown[]) => {
    lines.push(`${level} ${args.map(textOf).join(" ")}`);
    if (lines.length > capacity) lines.splice(0, lines.length - capacity);
  };
  return {
    install(target) {
      const { error, warn } = target;
      target.error = (...args: unknown[]) => {
        push("error", args);
        error.apply(target, args);
      };
      target.warn = (...args: unknown[]) => {
        push("warn", args);
        warn.apply(target, args);
      };
      return () => {
        target.error = error;
        target.warn = warn;
      };
    },
    tail: (n) => (n <= 0 ? [] : lines.slice(-n)),
  };
}
