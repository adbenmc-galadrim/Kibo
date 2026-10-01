import { afterAll, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { copyFixture, DEV_TOOLCHAIN } from "./test-kit";
import { validateComponent } from "./validate";

const disposers: (() => void)[] = [];
afterAll(() => {
  for (const d of disposers) d();
});
const fixture = (name: string) => {
  const f = copyFixture(name);
  disposers.push(f.dispose);
  return f.dir;
};
const opts = { toolchain: DEV_TOOLCHAIN, now: () => 1 };

const TICK_MS = 50;
const MAX_STALL_MS = 500;

async function longestStall<T>(work: () => Promise<T>): Promise<{ result: T; stall: number }> {
  let last = performance.now();
  let stall = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    stall = Math.max(stall, now - last);
    last = now;
  }, TICK_MS);
  try {
    const result = await work();
    stall = Math.max(stall, performance.now() - last);
    return { result, stall };
  } finally {
    clearInterval(timer);
  }
}

type Child = { pid: number; copy: string };

function staticCheckChildren(): Child[] {
  const out = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,stat=,command="]).stdout.toString();
  return out
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, ppid, stat, ...command]) => {
      const child = Number(ppid) === process.pid && !stat?.startsWith("Z");
      return child && command.join(" ").includes("static-check-main.ts");
    })
    .map((fields) => ({ pid: Number(fields[0]), copy: fields.at(-1) ?? "" }));
}

test("the event loop keeps running while a component is validated", async () => {
  const { result, stall } = await longestStall(() => validateComponent(fixture("hello"), opts));
  expect(result.typecheck).toEqual({ ok: true, errors: [] });
  expect(result.ok).toBe(true);
  expect(stall).toBeLessThan(MAX_STALL_MS);
}, 120_000);

test("an aborted validation kills its type checker and leaves nothing behind", async () => {
  const abort = new AbortController();
  const outcome = validateComponent(fixture("hello"), { ...opts, signal: abort.signal }).then(
    () => "resolved",
    (e: unknown) => (e instanceof KiboError ? `${e.code} ${e.detail}` : String(e)),
  );
  let children = staticCheckChildren();
  for (const started = Date.now(); children.length === 0; children = staticCheckChildren()) {
    if (Date.now() - started > 30_000) throw new Error("the type checker never started");
    await Bun.sleep(10);
  }
  const [checker] = children;
  const aborted = Date.now();
  abort.abort();
  expect(await outcome).toBe("INTERNAL validation aborted");
  expect(Date.now() - aborted).toBeLessThan(1_000);
  expect(staticCheckChildren()).toEqual([]);
  expect(checker?.copy).toContain("kibo-validate-");
  expect(existsSync(dirname(checker?.copy ?? ""))).toBe(false);
}, 60_000);

test("a bunfig.toml shipped by the component never preloads its code in the type checker", async () => {
  const dir = fixture("hello");
  const marker = join(dirname(dir), "escaped-marker");
  writeFileSync(join(dir, "bunfig.toml"), 'preload = ["./setup.ts"]\n');
  writeFileSync(
    join(dir, "setup.ts"),
    `import { writeFileSync } from "node:fs";\ntry {\n  writeFileSync(${JSON.stringify(marker)}, "escaped");\n} catch {}\n`,
  );
  await validateComponent(dir, opts);
  expect(existsSync(marker)).toBe(false);
}, 120_000);
