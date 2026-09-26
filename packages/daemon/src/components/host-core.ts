import {
  type BackendCode,
  type BackendDescription,
  BackendToDaemon,
  type ComponentCall,
  type ComponentManifest,
  type DaemonToBackend,
  type InvokeTarget,
  KiboError,
  type KiboErrorCode,
} from "@kibo/schema";
import { toWire } from "./runtime-core";
import { createSlots } from "./slots";

export type Channel = { send(msg: DaemonToBackend): void; close(): void };
export type ChannelHandlers = { message(raw: unknown): void; exit(reason: string): void };
export type ChannelFactory = (handlers: ChannelHandlers) => Promise<Channel>;
export type InvokeRequest = {
  projectId: string;
  instanceId: string;
  config: Record<string, unknown>;
  target: InvokeTarget;
  input: unknown;
};
export type CallHandler = (projectId: string, instanceId: string, call: ComponentCall) => Promise<unknown>;
export type HostOptions = {
  ref: string;
  manifest: ComponentManifest;
  code: BackendCode;
  onCall: CallHandler;
  beforeStart?: () => Promise<void>;
  idleMs?: number;
  timeoutMs?: number;
  readyTimeoutMs?: number;
  maxConcurrent?: number;
  backoffMs?: readonly number[];
  now?: () => number;
  log?: (line: string) => void;
};
export type BackendHost = {
  invoke(req: InvokeRequest): Promise<unknown>;
  describe(): Promise<BackendDescription>;
  stop(): void;
  readonly running: boolean;
};

type Inflight = {
  req: InvokeRequest;
  resolve(v: unknown): void;
  reject(e: unknown): void;
  timer: TimeoutHandle;
};
type Boot = { ok: true; description: BackendDescription } | { ok: false; error: KiboError };
type TimeoutHandle = ReturnType<typeof setTimeout>;

export const BACKEND_ERROR_CODES = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_FAILED",
  "MIGRATION_FAILED",
  "PERMISSION_DENIED",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "TIMEOUT",
  "TOO_LARGE",
  "INVALID_TRANSITION",
  "BLOCKED_REASON_REQUIRED",
  "TREE_CYCLE",
  "LINK_CYCLE",
  "FILE_CHANGED",
  "PATH_OUTSIDE_PROJECT",
] as const satisfies readonly KiboErrorCode[];

type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];
const BACKEND_ERRORS = new Set<string>(BACKEND_ERROR_CODES);
const isBackendErrorCode = (code: string): code is BackendErrorCode => BACKEND_ERRORS.has(code);

export function backendError(error: { code: string; message: string } | undefined): KiboError {
  const code = error?.code ?? "INTERNAL";
  const message = error?.message ?? "";
  return isBackendErrorCode(code)
    ? new KiboError(code, message)
    : new KiboError("INTERNAL", `${code}: ${message}`);
}

export const HOST_DEFAULTS = {
  timeoutMs: 30_000,
  idleMs: 300_000,
  readyTimeoutMs: 10_000,
  maxConcurrent: 4,
  backoffMs: [1_000, 5_000, 30_000],
} as const;

export function createHost(opts: HostOptions, open: ChannelFactory, codeInLoad: boolean): BackendHost {
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.error(`[kibo-daemon] ${opts.ref}: ${line}`));
  const timeoutMs = opts.timeoutMs ?? HOST_DEFAULTS.timeoutMs;
  const idleMs = opts.idleMs ?? HOST_DEFAULTS.idleMs;
  const backoff = opts.backoffMs ?? HOST_DEFAULTS.backoffMs;
  const slots = createSlots(opts.maxConcurrent ?? HOST_DEFAULTS.maxConcurrent);
  let channel: Channel | null = null;
  let generation = 0;
  let description: BackendDescription | null = null;
  let starting: Promise<BackendDescription> | null = null;
  let boot: ((outcome: Boot) => void) | null = null;
  let crashes = 0;
  let retryAt = 0;
  let seq = 0;
  let idle: TimeoutHandle | null = null;
  const inflight = new Map<number, Inflight>();

  const clearIdle = () => {
    if (idle) clearTimeout(idle);
    idle = null;
  };
  const deliver = (c: Channel, msg: DaemonToBackend) => {
    if (c !== channel) return log(`dropped ${msg.type} for a stopped backend`);
    try {
      c.send(msg);
    } catch (e) {
      log(`cannot send ${msg.type}: ${String(e)}`);
    }
  };
  const shutdown = (reason: string) => {
    const c = channel;
    const error = new KiboError("COMPONENT_CRASHED", `${opts.ref} stopped: ${reason}`);
    generation += 1;
    channel = null;
    description = null;
    starting = null;
    clearIdle();
    boot?.({ ok: false, error });
    boot = null;
    c?.close();
    for (const [id, p] of inflight) {
      clearTimeout(p.timer);
      inflight.delete(id);
      p.reject(error);
    }
  };
  const crash = (reason: string) => {
    log(`backend stopped: ${reason}`);
    crashes += 1;
    retryAt = now() + (backoff[Math.min(crashes - 1, backoff.length - 1)] ?? 0);
    shutdown(reason);
  };
  const scheduleIdle = () => {
    clearIdle();
    if (slots.busy === 0 && channel) idle = setTimeout(() => slots.busy === 0 && shutdown("idle"), idleMs);
  };

  const onCall = (c: Channel, msg: Extract<BackendToDaemon, { type: "call" }>) => {
    const owner = inflight.get(msg.invocation);
    if (!owner) {
      const error = { code: "PERMISSION_DENIED", message: "call outside of a running invocation" };
      return deliver(c, { type: "result", id: msg.id, ok: false, error });
    }
    opts.onCall(owner.req.projectId, owner.req.instanceId, msg.call).then(
      (result) => deliver(c, { type: "result", id: msg.id, ok: true, result: result ?? null }),
      (e: unknown) => deliver(c, { type: "result", id: msg.id, ok: false, error: toWire(e) }),
    );
  };

  const onMessage = (c: Channel, raw: unknown) => {
    const parsed = BackendToDaemon.safeParse(raw);
    if (!parsed.success) return crash(`protocol violation: ${parsed.error.message}`);
    const msg = parsed.data;
    if (msg.type === "call") return onCall(c, msg);
    if (msg.type === "ready") {
      if (!boot) return crash("protocol violation: unexpected ready message");
      description = { actions: msg.actions, jobs: msg.jobs };
      return boot({ ok: true, description });
    }
    const p = inflight.get(msg.id);
    if (!p) return crash(`protocol violation: result for unknown invocation ${msg.id}`);
    inflight.delete(msg.id);
    clearTimeout(p.timer);
    crashes = 0;
    if (msg.ok) p.resolve(msg.result ?? null);
    else p.reject(backendError(msg.error));
  };

  const start = async (): Promise<BackendDescription> => {
    if (now() < retryAt) throw new KiboError("COMPONENT_CRASHED", `${opts.ref} is restarting`);
    const before = generation;
    await opts.beforeStart?.();
    if (generation !== before) throw new KiboError("COMPONENT_CRASHED", `${opts.ref} stopped while starting`);
    generation += 1;
    const gen = generation;
    const booted = Promise.withResolvers<Boot>();
    boot = booted.resolve;
    const timer = setTimeout(
      () => booted.resolve({ ok: false, error: new KiboError("TIMEOUT", `${opts.ref} did not start`) }),
      opts.readyTimeoutMs ?? HOST_DEFAULTS.readyTimeoutMs,
    );
    let opened: Channel | null = null;
    try {
      const c = await open({
        message: (m) => gen === generation && opened && onMessage(opened, m),
        exit: (reason) => gen === generation && crash(reason),
      });
      opened = c;
      if (gen !== generation) {
        c.close();
        throw new KiboError("COMPONENT_CRASHED", `${opts.ref} exited while starting`);
      }
      channel = c;
      deliver(c, { type: "load", manifest: opts.manifest, ...(codeInLoad && { code: opts.code }) });
      const outcome = await booted.promise;
      if (!outcome.ok) throw outcome.error;
      return outcome.description;
    } catch (e) {
      if (gen === generation) crash(`start failed: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      clearTimeout(timer);
      if (boot === booted.resolve) boot = null;
    }
  };

  const ensure = (): Promise<BackendDescription> => {
    if (channel && description) return Promise.resolve(description);
    starting ??= start().catch((e: unknown) => {
      starting = null;
      throw e;
    });
    return starting;
  };

  const send = (c: Channel, req: InvokeRequest) =>
    new Promise<unknown>((resolve, reject) => {
      seq += 1;
      const id = seq;
      const timer = setTimeout(() => {
        inflight.delete(id);
        reject(new KiboError("TIMEOUT", `${opts.ref} took more than ${timeoutMs} ms`));
        shutdown("timeout");
      }, timeoutMs);
      inflight.set(id, { req, resolve, reject, timer });
      deliver(c, {
        type: "invoke",
        id,
        instanceId: req.instanceId,
        config: req.config,
        target: req.target,
        input: req.input,
      });
    });

  return {
    async invoke(req) {
      await slots.acquire(timeoutMs);
      try {
        clearIdle();
        await ensure();
        const c = channel;
        if (!c) throw new KiboError("COMPONENT_CRASHED", `${opts.ref} is not running`);
        return await send(c, req);
      } finally {
        slots.release();
        scheduleIdle();
      }
    },
    async describe() {
      const d = await ensure();
      scheduleIdle();
      return d;
    },
    stop: () => shutdown("stopped"),
    get running() {
      return channel !== null;
    },
  };
}
