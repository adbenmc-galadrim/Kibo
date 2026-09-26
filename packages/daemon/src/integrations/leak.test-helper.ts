import { Database } from "bun:sqlite";
import { spyOn } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LoroDoc } from "loro-crdt";
import { type FakeGithub, startFakeGithub } from "../testing/fake-github";
import { createRedactor, installConsoleRedaction, type Redactor } from "./redact";

export type Place = [where: string, content: string];

const METHODS = ["log", "info", "warn", "error", "debug"] as const;

export type CapturedOutput = { redactor: Redactor; lines(): string[]; restore(): void };

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("latin1");
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("latin1");
  return String(value);
}

export function captureOutput(): CapturedOutput {
  const lines: string[] = [];
  const originals = METHODS.map((m) => console[m]);
  for (const m of METHODS) console[m] = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  const redactor = createRedactor();
  const uninstall = installConsoleRedaction(redactor);
  const streams = [spyOn(process.stdout, "write"), spyOn(process.stderr, "write")];
  return {
    redactor,
    lines: () => [...lines, ...streams.flatMap((s) => s.mock.calls.map((c) => textOf(c[0])))],
    restore() {
      for (const s of streams) s.mockRestore();
      uninstall();
      METHODS.forEach((m, i) => {
        const original = originals[i];
        if (original) console[m] = original;
      });
    },
  };
}

export type WsCollector = { messages: string[]; close(): void };

export async function collectEvents(url: string, cookie: string): Promise<WsCollector> {
  const ws = new WebSocket(`${url.replace("http", "ws")}/api/events`, { headers: { origin: url, cookie } });
  ws.binaryType = "arraybuffer";
  const messages: string[] = [];
  ws.onmessage = (e) => void messages.push(textOf(e.data));
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("events socket failed to open"));
  });
  return { messages, close: () => ws.close() };
}

export type IntervalCapture = { fire(): void; restore(): void };

export function captureIntervalsFrom(file: string): IntervalCapture {
  const original = globalThis.setInterval;
  const captured: (() => void)[] = [];
  const spy = spyOn(globalThis, "setInterval").mockImplementation((...params: unknown[]) => {
    const [handler] = params;
    if (typeof handler === "function" && (new Error().stack ?? "").includes(file))
      captured.push(() => handler());
    return Reflect.apply(original, globalThis, params);
  });
  return {
    fire: () => {
      for (const run of captured) run();
    },
    restore: () => spy.mockRestore(),
  };
}

export async function until(check: () => Promise<boolean>, what: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await Bun.sleep(20);
  }
}

export function githubClone(dir: string): string {
  for (const args of [
    ["init", "-q"],
    ["remote", "add", "origin", "https://github.com/adam/kibo.git"],
  ]) {
    const r = Bun.spawnSync(["git", ...args], { cwd: dir, env: { PATH: process.env.PATH ?? "" } });
    if (r.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.toString()}`);
  }
  return dir;
}

export function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const bytesAsText = (_key: string, value: unknown): unknown =>
  value instanceof Uint8Array ? Buffer.from(value).toString("latin1") : value;

function tablesOf(db: Database): string[] {
  return db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((t) => t.name);
}

function loroDocs(db: Database, file: string): Place[] {
  if (!tablesOf(db).includes("docs")) return [];
  return db
    .query<{ id: string; snapshot: Uint8Array }, []>("SELECT id, snapshot FROM docs")
    .all()
    .map(
      (row): Place => [
        `loro doc ${row.id} in ${file}`,
        JSON.stringify(LoroDoc.fromSnapshot(row.snapshot).toJSON()),
      ],
    );
}

export function sqliteDumps(home: string): Place[] {
  return filesUnder(home)
    .filter((f) => f.endsWith(".db"))
    .flatMap((file) => {
      const db = new Database(file, { readonly: true });
      try {
        const tables = tablesOf(db).map(
          (table): Place => [
            `table ${table} in ${file}`,
            JSON.stringify(db.query(`SELECT * FROM "${table}"`).all(), bytesAsText),
          ],
        );
        return [...tables, ...loroDocs(db, file)];
      } finally {
        db.close();
      }
    });
}

export function rawFiles(home: string): Place[] {
  return filesUnder(home).map((f): Place => [f, readFileSync(f).toString("latin1")]);
}

export function leaksIn(places: Place[], secrets: string[]): string[] {
  return places.flatMap(([where, content]) =>
    secrets.filter((s) => content.includes(s)).map((s) => `${s.slice(0, 8)}… in ${where}`),
  );
}

export function seedGithub(token: string): FakeGithub {
  const fake = startFakeGithub({ token });
  fake.addRepo("adam/kibo").pulls.set(12, { headSha: "abc123", headRef: "kib-1" });
  fake.addRun("adam/kibo", {
    id: 900,
    headSha: "abc123",
    headBranch: "kib-1",
    name: "CI",
    status: "completed",
    conclusion: "failure",
    jobs: [
      {
        id: 70,
        name: "build",
        status: "completed",
        conclusion: "failure",
        startedAt: null,
        completedAt: null,
        log: `##[error]boom\nAuthorization: Bearer ${token}\n`,
      },
    ],
  });
  return fake;
}
