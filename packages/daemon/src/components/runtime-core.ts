import {
  applyMigrations,
  type BackendCode,
  type BackendDescription,
  type BackendToDaemon,
  ComponentCall,
  type DaemonToBackend,
  type InvokeTarget,
  isKiboErrorCode,
  KiboError,
  type MigrationStep,
  type Migrations,
} from "@kibo/schema";

type Json = Record<string, unknown>;
type Fn = (...args: unknown[]) => unknown;
type Job = { everyMinutes: number; run: Fn };
type Loaded = { actions: Record<string, Fn>; jobs: Record<string, Job>; migrations: Migrations };
type Invoke = Extract<DaemonToBackend, { type: "invoke" }>;
type WireError = { code: string; message: string };

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isFn = (v: unknown): v is Fn => typeof v === "function";

export function evaluateCjs(code: string, exportName: string): unknown {
  const mod: { exports: Json } = { exports: {} };
  const factory = new Function("module", "exports", code);
  factory(mod, mod.exports);
  return mod.exports[exportName];
}

const functions = (v: unknown): Record<string, Fn> =>
  Object.fromEntries(Object.entries(isRecord(v) ? v : {}).filter((e): e is [string, Fn] => isFn(e[1])));

function jobsOf(v: unknown): Record<string, Job> {
  const jobs: Record<string, Job> = {};
  for (const [name, job] of Object.entries(isRecord(v) ? v : {})) {
    if (!isRecord(job) || !isFn(job.run)) continue;
    const every = job.everyMinutes;
    if (typeof every === "number" && Number.isInteger(every) && every >= 1)
      jobs[name] = { everyMinutes: every, run: job.run };
  }
  return jobs;
}

const migrationFn =
  (n: number, fn: Fn) =>
  (old: Json): Json => {
    const out = fn(old);
    if (!isRecord(out)) throw new KiboError("MIGRATION_FAILED", `step ${n} returned a non-object`);
    return out;
  };

function migrationsOf(v: Json): Migrations {
  const steps: Record<number, MigrationStep> = {};
  for (const [key, step] of Object.entries(v)) {
    const n = Number(key);
    if (!Number.isInteger(n) || !isRecord(step)) continue;
    steps[n] = {
      ...(isFn(step.config) && { config: migrationFn(n, step.config) }),
      ...(isFn(step.data) && { data: migrationFn(n, step.data) }),
    };
  }
  return steps;
}

function load(code: BackendCode | null | undefined): Loaded {
  const server = code?.server ? evaluateCjs(code.server, "server") : {};
  const migrations = code?.migrations ? evaluateCjs(code.migrations, "migrations") : {};
  if (!isRecord(server) || !isRecord(migrations))
    throw new KiboError("VALIDATION_FAILED", "invalid backend exports");
  return {
    actions: functions(server.actions),
    jobs: jobsOf(server.jobs),
    migrations: migrationsOf(migrations),
  };
}

const describe = (l: Loaded): BackendDescription => ({
  actions: Object.keys(l.actions),
  jobs: Object.entries(l.jobs).map(([name, j]) => ({ name, everyMinutes: j.everyMinutes })),
});

export function toWire(e: unknown): WireError {
  if (isRecord(e) && isKiboErrorCode(e.code)) {
    const message = typeof e.detail === "string" ? e.detail : typeof e.message === "string" ? e.message : "";
    return { code: e.code, message };
  }
  return { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
}

export const fromWire = (error: WireError | undefined): KiboError =>
  new KiboError(isKiboErrorCode(error?.code) ? error.code : "INTERNAL", error?.message ?? "");

function toJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) ?? null;
  } catch (e) {
    throw new KiboError(
      "INTERNAL",
      `result is not serializable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

type Pending = { resolve(v: unknown): void; reject(e: unknown): void };
type FetchOptions = { method?: string; headers?: Record<string, string>; body?: string };

function contextFactory(send: (m: BackendToDaemon) => void) {
  let seq = 0;
  const pending = new Map<number, Pending>();
  const context = (invocation: number, instanceId: string, config: Json) => {
    const call = (raw: unknown) => {
      const parsed = ComponentCall.safeParse(raw);
      if (!parsed.success) return Promise.reject(new KiboError("INVALID_INPUT", parsed.error.message));
      return new Promise<unknown>((resolve, reject) => {
        seq += 1;
        pending.set(seq, { resolve, reject });
        send({ type: "call", id: seq, invocation, call: parsed.data });
      });
    };
    return {
      instanceId,
      config,
      list: (entity: unknown) => call({ kind: "list", entity }),
      run: (command: unknown) => call({ kind: "run", command }),
      data: {
        get: (key: unknown) => call({ kind: "data.get", key }),
        set: async (key: unknown, value: unknown) => {
          await call({ kind: "data.set", key, value });
        },
        delete: async (key: unknown) => {
          await call({ kind: "data.delete", key });
        },
        keys: () => call({ kind: "data.keys" }),
      },
      fetch: (url: unknown, init: FetchOptions = {}) => call({ kind: "fetch", url, init }),
    };
  };
  const settle = (msg: Extract<DaemonToBackend, { type: "result" }>) => {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result ?? null);
    else p.reject(fromWire(msg.error));
  };
  return { context, settle };
}

async function run(loaded: Loaded, msg: Invoke, ctx: unknown) {
  const target: InvokeTarget = msg.target;
  if ("action" in target) {
    const fn = loaded.actions[target.action];
    if (!fn) throw new KiboError("PERMISSION_DENIED", `unknown action ${target.action}`);
    return fn(ctx, msg.input);
  }
  if ("job" in target) {
    const job = loaded.jobs[target.job];
    if (!job) throw new KiboError("NOT_FOUND", `unknown job ${target.job}`);
    await job.run(ctx);
    return null;
  }
  const m = target.migrate;
  return applyMigrations(loaded.migrations, m.from, m.to, { config: m.config, data: m.data });
}

export function createRuntime(
  send: (m: BackendToDaemon) => void,
  code: BackendCode | null,
): { handle(m: DaemonToBackend): void } {
  let loaded: Loaded | null = null;
  const { context, settle } = contextFactory(send);

  const invoke = async (msg: Invoke) => {
    if (!loaded) throw new KiboError("INTERNAL", "backend is not loaded");
    return toJson(await run(loaded, msg, context(msg.id, msg.instanceId, msg.config)));
  };

  return {
    handle(msg) {
      if (msg.type === "load") {
        loaded = load(msg.code ?? code);
        send({ type: "ready", ...describe(loaded) });
        return;
      }
      if (msg.type === "invoke") {
        invoke(msg).then(
          (result) => send({ type: "result", id: msg.id, ok: true, result }),
          (e: unknown) => send({ type: "result", id: msg.id, ok: false, error: toWire(e) }),
        );
        return;
      }
      settle(msg);
    },
  };
}
