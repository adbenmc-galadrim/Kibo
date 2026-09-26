import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { type RunningServer, startServer } from "../server";
import { createService } from "../service";
import { openSessionStore } from "../sessions/session-store";
import { openLocalSettings } from "../settings";
import { openStore, type Store } from "../store";
import type { NetworkAddress } from "./interfaces";
import { PairingCodes } from "./pairing-codes";
import { createRemoteAccess, type RemoteAccess } from "./remote-access";
import { remoteRpc } from "./rpc";

export const TOKEN = "a".repeat(64);

export type RemoteFixture = {
  home: string;
  store: Store;
  codes: PairingCodes;
  secrets: MemorySecretStore;
  server: RunningServer;
  port: number;
  remote: RemoteAccess;
};

const LOOPBACK: NetworkAddress[] = [{ name: "lo0", address: "127.0.0.1" }];

export function freePort(): number {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = probe.port;
  probe.stop(true);
  return port;
}

export function makeRemote(
  f: Pick<RemoteFixture, "home" | "store" | "secrets" | "server">,
  interfaces: NetworkAddress[] = LOOPBACK,
): RemoteAccess {
  return createRemoteAccess({
    home: f.home,
    settings: openLocalSettings(f.store),
    secrets: f.secrets,
    interfaces: () => interfaces,
    listen: (input) => f.server.listenRemote(input),
    log: () => {},
  });
}

export function startRemoteFixture(): RemoteFixture {
  const home = mkdtempSync(join(tmpdir(), "kibo-remote-"));
  const store = openStore(home);
  const codes = new PairingCodes(Date.now);
  const secrets = createMemorySecretStore(createRedactor());
  const server = startServer({
    service: createService(store, { user: "adam" }),
    sessions: openSessionStore(store.db),
    pairingCodes: codes,
    token: TOKEN,
    port: 0,
    uiDir: null,
    extensions: [remoteRpc(() => fixture.remote, codes)],
  });
  const fixture: RemoteFixture = {
    home,
    store,
    codes,
    secrets,
    server,
    port: freePort(),
    remote: makeRemote({ home, store, secrets, server }),
  };
  return fixture;
}

export function stopRemoteFixture(f: RemoteFixture): void {
  f.remote.stop();
  f.server.stop();
  f.store.close();
  rmSync(f.home, { recursive: true, force: true });
}

export const enableSelfSigned = (f: RemoteFixture) =>
  f.remote.enable({ address: "127.0.0.1", port: f.port, tls: { kind: "self-signed" } });
export const certOf = (f: RemoteFixture) => readFileSync(join(f.home, "remote", "cert.pem"), "utf8");
export const remoteUrl = (f: RemoteFixture) => `https://127.0.0.1:${f.port}`;

export function remotePost(
  f: RemoteFixture,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  ca = certOf(f),
): Promise<Response> {
  return fetch(`${remoteUrl(f)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: remoteUrl(f), ...headers },
    body: JSON.stringify(body),
    tls: { ca },
  });
}

export function localPost(f: RemoteFixture, path: string, body: unknown, cookie = ""): Promise<Response> {
  return fetch(`${f.server.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: f.server.url, cookie },
    body: JSON.stringify(body),
  });
}

export async function localPair(f: RemoteFixture): Promise<string> {
  const res = await localPost(f, "/api/pair", { token: TOKEN });
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}

export async function remotePair(f: RemoteFixture): Promise<string> {
  const res = await remotePost(f, "/api/pair-code", { code: f.codes.create().code });
  expect(res.status).toBe(204);
  return res.headers.get("set-cookie") ?? "";
}

export const remoteCookie = async (f: RemoteFixture) => (await remotePair(f)).split(";")[0] ?? "";
