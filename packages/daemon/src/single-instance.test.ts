import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeDaemonInfo } from "./components/daemon-info";
import { DaemonRunning, findRunningDaemon, HEALTH_TIMEOUT_MS, probeHealth } from "./single-instance";

const homes: string[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop(true);
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});
const home = () => {
  const h = mkdtempSync(join(tmpdir(), "kibo-single-"));
  homes.push(h);
  return h;
};
const serve = (fetch: (req: Request) => Response | Promise<Response>) => {
  const s = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch });
  servers.push(s);
  return s.port ?? 0;
};
const closedPort = () => {
  const s = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("x") });
  const port = s.port ?? 0;
  s.stop(true);
  return port;
};

test("the probe tells a kibo daemon, a silent listener and a closed port apart", async () => {
  const kibo = serve((req) =>
    new URL(req.url).pathname === "/api/health"
      ? Response.json({ pid: 4242 })
      : new Response("no", { status: 404 }),
  );
  expect(await probeHealth(kibo)).toEqual({ pid: 4242 });
  const other = serve(() => new Response("<html>", { status: 200 }));
  expect(await probeHealth(other)).toBe("silent");
  const mute = serve(() => new Promise<Response>(() => {}));
  const started = Date.now();
  expect(await probeHealth(mute)).toBe("silent");
  expect(Date.now() - started).toBeGreaterThanOrEqual(HEALTH_TIMEOUT_MS - 50);
  expect(Date.now() - started).toBeLessThan(HEALTH_TIMEOUT_MS + 1_000);
  expect(await probeHealth(closedPort())).toBe("refused");
}, 10_000);

test("no daemon.json, a corrupt one or a closed port mean nobody is running", async () => {
  const h = home();
  expect(await findRunningDaemon(h, async () => ({ pid: 1 }))).toBeNull();
  writeFileSync(join(h, "daemon.json"), "{not json");
  expect(await findRunningDaemon(h, async () => ({ pid: 1 }))).toBeNull();
  writeDaemonInfo(h, { port: 4317, sandboxPort: 4318, pid: 99_999 });
  expect(await findRunningDaemon(h, async () => "refused")).toBeNull();
});

test("a daemon that answers or holds the port is reported with its info", async () => {
  const h = home();
  writeDaemonInfo(h, { port: 4317, sandboxPort: 4318, pid: 777 });
  const probed: number[] = [];
  expect(
    await findRunningDaemon(h, async (port) => {
      probed.push(port);
      return { pid: 777 };
    }),
  ).toEqual({ info: { port: 4317, sandboxPort: 4318, pid: 777 }, answers: true });
  expect(probed).toEqual([4317]);
  expect(await findRunningDaemon(h, async () => "silent")).toEqual({
    info: { port: 4317, sandboxPort: 4318, pid: 777 },
    answers: false,
  });
});

test("DaemonRunning is a KiboError that says who holds the home", () => {
  const info = { port: 4317, sandboxPort: 4318, pid: 777 };
  const answering = new DaemonRunning("/h", { info, answers: true });
  expect(answering).toBeInstanceOf(Error);
  expect(answering.code).toBe("DAEMON_RUNNING");
  expect(answering.detail).toBe("another daemon (pid 777) serves /h at http://127.0.0.1:4317");
  expect(new DaemonRunning("/h", { info, answers: false }).detail).toBe(
    "another daemon (pid 777) holds /h at http://127.0.0.1:4317 and does not answer",
  );
});
