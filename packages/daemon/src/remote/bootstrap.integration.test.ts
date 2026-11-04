import { afterEach, expect, test } from "bun:test";
import {
  decodePairingCode,
  deriveKeys,
  openReply,
  openSnapshot,
  Sealed,
  SealedRequest,
  SnapshotHeader,
  sealRequest,
} from "@kibo/remote";
import { startTestServer, TEST_ORIGIN, type TestServer } from "@kibo/remote-server/testing";
import { type ChangeMessage, KiboError, type RemoteStatus, type RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { questionImageFiles } from "../questions/question-images-port";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { openStore, type Store } from "../store";
import { type RemoteModule, startRemote } from "./bootstrap";
import { cleanLaunched, type LaunchedDaemon, launchDaemon, seedSilo, tempDir } from "./remote.test-helper";

const cleanups: (() => Promise<unknown> | unknown)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
  await cleanLaunched();
});

const HeaderList = z.array(SnapshotHeader);
const PROJECT_KINDS = ["agent", "ci", "events", "project", "t3"];
const Relayed = z.object({ sealed: SealedRequest });

async function until(check: () => boolean | Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > end) throw new Error("condition not reached");
    await Bun.sleep(20);
  }
}

type Rig = {
  server: TestServer;
  launched: LaunchedDaemon;
  store: Store;
  keychain: MemorySecretStore;
  remote: RemoteModule;
  deps: Parameters<typeof startRemote>[0];
  logs: string[];
  emit(message: ChangeMessage): void;
  rpc(req: RpcRequest): Promise<unknown>;
};

async function rig(): Promise<Rig> {
  const server = await startTestServer();
  cleanups.push(() => server.stop());
  const launched = await launchDaemon();
  const store = openStore(tempDir("kibo-remote-mac-"));
  cleanups.push(() => store.close());
  const keychain = createMemorySecretStore(createRedactor());
  const listeners = new Set<(message: ChangeMessage) => void>();
  const logs: string[] = [];
  const deps: Parameters<typeof startRemote>[0] = {
    store,
    secrets: keychain,
    defaultUrl: server.url,
    dispatch: async (req) => {
      const answer = await launched.call(req);
      if (answer.ok) return answer.result;
      const error = z.object({ code: z.string(), message: z.string() }).parse(answer.error);
      throw new KiboError("REMOTE_REJECTED", `${error.code}: ${error.message}`);
    },
    readImage: questionImageFiles(launched.home, () => null).read,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onProjectRemoved: () => () => {},
    now: Date.now,
    log: (line) => logs.push(line),
    redact: (text) => text,
  };
  const remote = startRemote(deps);
  cleanups.push(() => remote.stop());
  return {
    server,
    launched,
    store,
    keychain,
    remote,
    deps,
    logs,
    emit: (message) => {
      for (const listener of listeners) listener(message);
    },
    rpc: (req) => remote.rpc.handle(req, LOCAL_CONTEXT),
  };
}

const status = async (r: Rig) => (await r.rpc({ method: "remote.status" })) as RemoteStatus;
const enable = (r: Rig, setupCode = r.server.setupCode) =>
  r.rpc({ method: "remote.enable", serverUrl: r.server.url, setupCode }) as Promise<RemoteStatus>;

async function snapshots(r: Rig, projectId: string, cookie = r.server.phoneCookie()) {
  const phoneGet = (path: string) => fetch(`${r.server.url}/api/phone/${path}`, { headers: { cookie } });
  const res = await phoneGet(`snapshot-headers?projectId=${projectId}`);
  if (res.status !== 200) return res.status;
  const blocks: Sealed[] = [];
  for (const { kind } of HeaderList.parse(await res.json())) {
    const block = await phoneGet(`snapshot?projectId=${projectId}&kind=${encodeURIComponent(kind)}`);
    if (block.status === 200) blocks.push(Sealed.parse(await block.json()));
  }
  return blocks;
}

const keychainRoot = (r: Rig) =>
  new Uint8Array(Buffer.from(r.keychain.dump().get("remote") ?? "", "base64url"));
const accountOf = (r: Rig) => r.store.getLocal("remote.accountId") ?? "";

test("remote.enable registers on the server, stores the token and key, connects, status is { enabled: true, connected: true }", async () => {
  const r = await rig();
  expect(await status(r)).toMatchObject({ enabled: false, connected: false, keyEpoch: 0, projects: [] });
  expect(await enable(r)).toMatchObject({
    enabled: true,
    connected: true,
    serverUrl: r.server.url,
    keyEpoch: 1,
  });
  expect([...r.keychain.dump().keys()].sort()).toEqual(["remote", "remote:server"]);
  expect(keychainRoot(r).byteLength).toBe(32);
  const res = await fetch(`${r.server.url}/api/health`);
  expect(await res.json()).toEqual({ ok: true, mac: "online" });
});

test("remote.enable with a wrong setup code throws REMOTE_REJECTED and stores nothing", async () => {
  const r = await rig();
  const refused = await enable(r, "wrong-setup-code").catch((e: unknown) => e);
  expect(refused instanceof KiboError && refused.code).toBe("REMOTE_REJECTED");
  expect(refused instanceof KiboError && refused.detail).toBe("Code d'installation refusé par le serveur");
  expect([...r.keychain.dump().keys()]).toEqual([]);
  expect(r.store.db.query("SELECT key FROM local_state WHERE key LIKE 'remote.%'").all()).toEqual([]);
  expect(await status(r)).toMatchObject({ enabled: false, connected: false });
});

test("remote.createPairing returns a kibo1. code whose decoded rootKey equals the keychain key and whose pairToken the server accepts", async () => {
  const r = await rig();
  await enable(r);
  const pairing = (await r.rpc({ method: "remote.createPairing" })) as { code: string; expiresAt: number };
  expect(pairing.code.startsWith("kibo1.")).toBe(true);
  const decoded = decodePairingCode(pairing.code);
  expect(decoded.rootKey).toEqual(keychainRoot(r));
  expect(decoded.accountId).toBe(accountOf(r));
  const pairOptions = (pairToken: string) =>
    fetch(`${r.server.url}/api/phone/pair/options`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_ORIGIN },
      body: JSON.stringify({ accountId: decoded.accountId, pairToken }),
    });
  expect((await pairOptions(decoded.pairToken)).status).toBe(200);
  const refused = await pairOptions("AAAAAAAAAAAAAAAAAAAAAA");
  expect(await refused.json()).toMatchObject({ ok: false, error: { code: "REMOTE_PAIRING_INVALID" } });
  expect(await status(r)).toMatchObject({ phonePaired: true });
});

async function indexOpensWith(r: Rig, code: string): Promise<number> {
  const decoded = decodePairingCode(code);
  const res = await fetch(`${r.server.url}/api/phone/snapshot?projectId=_&kind=projects`, {
    headers: { cookie: r.server.phoneCookie() },
  });
  expect(res.status).toBe(200);
  const index = Sealed.parse(await res.json());
  const keys = await deriveKeys(decoded.rootKey, decoded.accountId, index.header.keyEpoch);
  await openSnapshot(keys, index);
  return index.header.keyEpoch;
}

test("the index of the current epoch is on the server when a pairing code is returned, also after a re-pairing", async () => {
  const r = await rig();
  await enable(r);
  const first = (await r.rpc({ method: "remote.createPairing" })) as { code: string };
  expect(await indexOpensWith(r, first.code)).toBe(1);
  const second = (await r.rpc({ method: "remote.createPairing" })) as { code: string };
  expect(await indexOpensWith(r, second.code)).toBe(2);
});

test("enabling a project pushes its blocks and disabling it removes them from the server", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const blocks = await snapshots(r, silo.projectId);
  if (typeof blocks === "number") throw new Error(`snapshots answered ${blocks}`);
  expect(blocks.map((b) => b.header.kind).sort()).toEqual(PROJECT_KINDS);
  const keys = await deriveKeys(keychainRoot(r), accountOf(r), 1);
  const project = blocks.find((b) => b.header.kind === "project");
  if (!project) throw new Error("no project block");
  expect(JSON.parse(new TextDecoder().decode(await openSnapshot(keys, project))).meta.name).toBe("Silo");
  expect(await status(r)).toMatchObject({ projects: [silo.projectId] });
  expect((await status(r)).lastPushAt).not.toBeNull();

  await r.rpc({ method: "remote.setProjects", projectIds: [] });
  const started = Date.now();
  await until(async () => {
    const left = await snapshots(r, silo.projectId);
    return Array.isArray(left) && left.length === 0;
  }, 1_000);
  expect(Date.now() - started).toBeLessThan(1_000);
});

test("a project change is pushed again within 2 s", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const seqOf = async () => {
    const blocks = await snapshots(r, silo.projectId);
    return Array.isArray(blocks) ? (blocks.find((b) => b.header.kind === "project")?.header.seq ?? 0) : 0;
  };
  const before = await seqOf();
  await r.launched.rpc({
    method: "command",
    projectId: silo.projectId,
    command: { method: "createTicket", title: "Export des quotas" },
  });
  r.emit({ projectId: silo.projectId });
  await until(async () => (await seqOf()) > before, 3_000);
});

test("a phone request goes through the server and the gate to the daemon", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  const keys = await deriveKeys(keychainRoot(r), accountOf(r), 1);
  const header = {
    v: 1 as const,
    requestId: crypto.randomUUID(),
    projectId: silo.projectId,
    at: Date.now(),
    keyEpoch: 1,
  };
  const body = new TextEncoder().encode(JSON.stringify({ method: "getProject", projectId: silo.projectId }));
  const res = await fetch(`${r.server.url}/api/phone/request`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: r.server.phoneCookie(), origin: TEST_ORIGIN },
    body: JSON.stringify({ sealed: await sealRequest(keys, header, body) }),
  });
  const { sealed } = Relayed.parse(await res.json());
  const answer = JSON.parse(new TextDecoder().decode(await openReply(keys, sealed)));
  expect(answer).toMatchObject({ ok: true, result: { meta: { name: "Silo" } } });
});

test("remote.revokePhone bumps keyEpoch, rotates the key and pushes everything", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  await r.rpc({ method: "remote.createPairing" });
  const oldPhone = r.server.phoneCookie();
  const oldRoot = keychainRoot(r);
  expect(await r.rpc({ method: "remote.revokePhone" })).toMatchObject({ keyEpoch: 2, phonePaired: false });
  expect(keychainRoot(r)).not.toEqual(oldRoot);
  expect(await snapshots(r, silo.projectId, oldPhone)).toBe(401);
  const keys = await deriveKeys(keychainRoot(r), accountOf(r), 2);
  await until(async () => {
    const blocks = await snapshots(r, silo.projectId);
    return (
      Array.isArray(blocks) &&
      blocks.length === PROJECT_KINDS.length &&
      blocks.every((b) => b.header.keyEpoch === 2)
    );
  });
  const blocks = await snapshots(r, silo.projectId);
  if (typeof blocks === "number") throw new Error(`snapshots answered ${blocks}`);
  for (const block of blocks) await openSnapshot(keys, block);
});

test("remote.disable closes the socket, revokes the phone, clears secrets and settings", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const phone = r.server.phoneCookie();
  expect(await r.rpc({ method: "remote.disable" })).toMatchObject({
    enabled: false,
    connected: false,
    projects: [],
    keyEpoch: 0,
    phonePaired: false,
  });
  await until(async () => (await snapshots(r, silo.projectId, phone)) === 401);
  await until(
    async () =>
      ((await (await fetch(`${r.server.url}/api/health`)).json()) as { mac: string }).mac === "offline",
  );
  expect([...r.keychain.dump().keys()]).toEqual([]);
  expect(r.store.db.query("SELECT key FROM local_state WHERE key LIKE 'remote.%'").all()).toEqual([]);
});

test("remote.disable while the server is unreachable leaves a pending revocation that completes when it comes back", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const phone = r.server.phoneCookie();
  await r.server.pause();
  await until(async () => !(await status(r)).connected);
  expect(await r.rpc({ method: "remote.disable" })).toMatchObject({
    enabled: false,
    connected: false,
    projects: [],
    revokePending: true,
  });
  expect([...r.keychain.dump().keys()]).toEqual(["remote:server"]);
  expect(r.store.getLocal("remote.pendingRevoke")).toBe("1");
  r.server.resume();
  await until(async () => !(await status(r)).revokePending, 8_000);
  expect(await snapshots(r, silo.projectId, phone)).toBe(401);
  expect(await snapshots(r, silo.projectId)).toEqual([]);
  expect([...r.keychain.dump().keys()]).toEqual([]);
  expect(r.store.db.query("SELECT key FROM local_state WHERE key LIKE 'remote.%'").all()).toEqual([]);
});

test("enable after an offline disable refuses the old phone session", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const oldPhone = r.server.phoneCookie();
  await r.server.pause();
  await until(async () => !(await status(r)).connected);
  await r.rpc({ method: "remote.disable" });
  r.server.resume();
  expect(await enable(r)).toMatchObject({ enabled: true, connected: true, revokePending: false });
  expect(await snapshots(r, silo.projectId, oldPhone)).toBe(401);
  expect(r.store.getLocal("remote.pendingRevoke")).not.toBe("1");
});

test("an offline disable without a mac token says the phone could not be revoked until the next enable", async () => {
  const r = await rig();
  await enable(r);
  await r.server.pause();
  await until(async () => !(await status(r)).connected);
  await r.keychain.delete("remote:server");
  expect(await r.rpc({ method: "remote.disable" })).toMatchObject({
    enabled: false,
    revokePending: false,
    revokeAbandoned: true,
  });
  expect([...r.keychain.dump().keys()]).toEqual([]);
  r.server.resume();
  expect(await enable(r)).toMatchObject({ enabled: true, revokeAbandoned: false });
});

test("a pending revocation is retried when the daemon starts again", async () => {
  const r = await rig();
  const silo = await seedSilo(r.launched);
  await enable(r);
  await r.rpc({ method: "remote.setProjects", projectIds: [silo.projectId] });
  const phone = r.server.phoneCookie();
  await r.server.pause();
  await until(async () => !(await status(r)).connected);
  await r.rpc({ method: "remote.disable" });
  await r.remote.stop();
  r.server.resume();
  const again = startRemote({ ...r.deps, log: () => {} });
  cleanups.push(() => again.stop());
  await until(async () => !(await again.status()).revokePending, 8_000);
  expect(await snapshots(r, silo.projectId, phone)).toBe(401);
  expect([...r.keychain.dump().keys()]).toEqual([]);
});

test("the remote module of the daemon answers remote.* and the daemon still serves only 127.0.0.1", async () => {
  const server = await startTestServer();
  cleanups.push(() => server.stop());
  const launched = await launchDaemon({ remoteUrl: server.url });
  expect(launched.daemon.url).toStartWith("http://127.0.0.1:");
  expect(await launched.rpc({ method: "remote.status" })).toMatchObject({
    enabled: false,
    serverUrl: server.url,
  });
  expect(
    await launched.rpc({ method: "remote.enable", serverUrl: server.url, setupCode: server.setupCode }),
  ).toMatchObject({ enabled: true, connected: true });
  const refused = await fetch(`http://localhost:${launched.daemon.port}/api/health`, {
    headers: { host: `192.168.1.20:${launched.daemon.port}` },
  });
  expect(refused.status).toBe(403);
  expect(await launched.rpc({ method: "remote.disable" })).toMatchObject({ enabled: false });
});
