import { defineServer, type ServerContext } from "@kibo/sdk/server";

type Escape = { secret: string; plant: string; port: number };
type Attempt = () => unknown;
type Socket = { on(event: string, listener: (e?: unknown) => void): void; destroy(): void };
type Net = { connect(port: number, host: string): Socket };

const load = (() => 0).constructor("s", "return import(s)");
const OUTPUT_FD = 4;
const OVERSIZE = 5 * 1024 * 1024;
let kept: ServerContext | null = null;

function codeOf(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e ? String(e.code) : String(e);
}

async function refusal(attempt: Attempt): Promise<string> {
  try {
    await attempt();
    return "allowed";
  } catch (e) {
    return codeOf(e);
  }
}

async function barrier(attempt: Attempt): Promise<string> {
  try {
    await attempt();
    return "open";
  } catch {
    return "blocked";
  }
}

function escapeInput(input: unknown): Escape {
  const value = Object(input);
  return { secret: String(value.secret), plant: String(value.plant), port: Number(value.port) };
}

function workerSource({ secret, port }: Escape): string {
  return [
    'const attempt = (fn) => fn().then(() => "open", () => "blocked");',
    `const net = attempt(() => fetch("http://127.0.0.1:${port}/"));`,
    `const read = attempt(() => Bun.file(${JSON.stringify(secret)}).text());`,
    "Promise.all([net, read]).then(([n, r]) => postMessage({ net: n, read: r }));",
  ].join("\n");
}

function inWorker(source: string): Promise<unknown> {
  return new Promise((resolve) => {
    const worker = new Worker(URL.createObjectURL(new Blob([source])));
    const timer = setTimeout(() => {
      worker.terminate();
      resolve("no worker");
    }, 5_000);
    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
  });
}

function connect(net: Net, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.on("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.on("error", reject);
    setTimeout(() => reject(new Error("timeout")), 3_000);
  });
}

function oversizedCall(): string {
  const value = "x".repeat(OVERSIZE);
  return JSON.stringify({ type: "call", id: 0, invocation: 0, call: { kind: "data.set", key: "k", value } });
}

async function writeRaw(line: string): Promise<null> {
  const fs = await load("node:fs");
  const bytes = new TextEncoder().encode(`${line}\n`);
  for (let offset = 0; offset < bytes.length; ) {
    try {
      offset += fs.writeSync(OUTPUT_FD, bytes, offset, bytes.length - offset);
    } catch (e) {
      if (codeOf(e) !== "EAGAIN") throw e;
      await new Promise((r) => setTimeout(r, 1));
    }
  }
  return null;
}

export const server = defineServer({
  actions: {
    ping: async () => "pong",
    self: async () => ({ pid: process.pid, cwd: process.cwd() }),
    linger: () => new Promise(() => undefined),
    attack: async (ctx) => {
      const tickets = await ctx.list("ticket");
      const ticketId = tickets[0]?.id ?? "";
      const refusals = {
        deleteTicket: await refusal(() => ctx.run({ method: "deleteTicket", ticketId })),
        fetch: await refusal(() => ctx.fetch("https://example.com")),
        loopback: await refusal(() => ctx.fetch("https://kibo-evil.test/")),
        data: await refusal(() => ctx.data.set("k", 1)),
        reserved: await refusal(() =>
          ctx.run({ method: "setInstanceData", instanceId: ctx.instanceId, key: "k", value: 1 }),
        ),
        links: await refusal(() => ctx.list("link")),
      };
      const globals = {
        fetch: typeof fetch,
        file: typeof Bun.file,
        spawn: typeof Bun.spawn,
        binding: typeof process.binding,
      };
      return { tickets: tickets.length, refusals, globals };
    },
    keep: async (ctx) => {
      kept = ctx;
      return null;
    },
    reuse: async () => refusal(() => kept?.list("ticket")),
    escape: async (_ctx, input) => {
      const target = escapeInput(input);
      const fs = await load("node:fs");
      const cp = await load("node:child_process");
      const net = await load("node:net");
      const readSecret = `require("node:fs").readFileSync(${JSON.stringify(target.secret)})`;
      return {
        workdir: await barrier(() => fs.writeFileSync("probe", "x")),
        read: await barrier(() => fs.readFileSync(target.secret, "utf8")),
        write: await barrier(() => fs.writeFileSync(target.plant, "x")),
        spawn: await barrier(() => cp.execFileSync("/bin/sh", ["-c", "exit 0"], { stdio: "ignore" })),
        child: await barrier(() =>
          cp.execFileSync(process.execPath, ["-e", readSecret], { stdio: "ignore" }),
        ),
        connect: await barrier(() => connect(net, target.port)),
        worker: await inWorker(workerSource(target)),
      };
    },
    forge: async (_ctx, code) => {
      throw Object.assign(new Error("approve me again"), { code: String(code) });
    },
    garbage: async () => writeRaw("not json"),
    oversize: async () => writeRaw(oversizedCall()),
    flood: async (ctx) => {
      const settled = await Promise.allSettled(Array.from({ length: 1_000 }, () => ctx.list("ticket")));
      const codes = settled.flatMap((s) => (s.status === "rejected" ? [codeOf(s.reason)] : []));
      return {
        allowed: settled.length - codes.length,
        limited: codes.filter((c) => c === "RATE_LIMITED").length,
        other: codes.filter((c) => c !== "RATE_LIMITED"),
      };
    },
  },
});
