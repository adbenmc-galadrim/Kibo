import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateSelfSignedCert } from "@kibo/trust";
import {
  certOf,
  enableSelfSigned,
  localPair,
  localPost,
  makeRemote,
  type RemoteFixture,
  remotePost,
  remoteUrl,
  startRemoteFixture,
  stopRemoteFixture,
} from "./remote.test-helper";

let f: RemoteFixture;
beforeEach(() => {
  f = startRemoteFixture();
});
afterEach(() => stopRemoteFixture(f));

const restart = (interfaces?: { name: string; address: string }[]) => {
  f.remote.stop();
  f.remote = makeRemote(f, interfaces);
  return f.remote.resume();
};

describe("remote access lifecycle", () => {
  test("is disabled by default", () => {
    expect(f.remote.status()).toMatchObject({
      enabled: false,
      address: null,
      port: null,
      url: null,
      fingerprint: null,
      tls: null,
      lastError: null,
    });
  });

  test("the wildcard and foreign addresses are refused", async () => {
    const tls = { kind: "self-signed" } as const;
    await expect(f.remote.enable({ address: "0.0.0.0", port: f.port, tls })).rejects.toThrow("INVALID_INPUT");
    await expect(f.remote.enable({ address: "10.9.8.7", port: f.port, tls })).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(f.remote.status().enabled).toBe(false);
  });

  test("disabling closes the listener", async () => {
    await enableSelfSigned(f);
    await f.remote.disable();
    expect(f.remote.status().enabled).toBe(false);
    await expect(fetch(`${remoteUrl(f)}/`, { tls: { ca: certOf(f) } })).rejects.toThrow();
  });

  test("the certificate is 0600 and the private key never touches the disk", async () => {
    await enableSelfSigned(f);
    expect(statSync(join(f.home, "remote", "cert.pem")).mode & 0o777).toBe(0o600);
    expect(await f.secrets.has("remote:tls")).toBe(true);
    const files = readdirSync(f.home, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
    for (const file of files) {
      expect(readFileSync(join(file.parentPath, file.name)).includes("PRIVATE KEY")).toBe(false);
    }
  });

  test("an enabled access resumes after a restart with the same fingerprint", async () => {
    const first = await enableSelfSigned(f);
    await restart();
    expect(f.remote.status()).toMatchObject({ enabled: true, fingerprint: first.fingerprint });
  });

  test("a disabled access stays off after a restart", async () => {
    await enableSelfSigned(f);
    await f.remote.disable();
    await restart();
    expect(f.remote.status().enabled).toBe(false);
  });

  test("a failed resume keeps the daemon up and reports the error code", async () => {
    await enableSelfSigned(f);
    await restart([]);
    expect(f.remote.status()).toMatchObject({ enabled: false, lastError: "INVALID_INPUT" });
  });

  test("a provided full chain is served and fingerprinted by its leaf", async () => {
    const leaf = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 30 });
    const other = await generateSelfSignedCert({ commonName: "CA", dns: [], ips: [], days: 30 });
    const certFile = join(f.home, "fullchain.pem");
    const keyFile = join(f.home, "key.pem");
    writeFileSync(certFile, leaf.certPem + other.certPem);
    writeFileSync(keyFile, leaf.keyPem, { mode: 0o600 });
    const status = await f.remote.enable({
      address: "127.0.0.1",
      port: f.port,
      tls: { kind: "provided", certFile, keyFile },
    });
    expect(status).toMatchObject({ enabled: true, tls: "provided", fingerprint: leaf.fingerprint256 });
    const res = await remotePost(f, "/api/pair-code", { code: f.codes.create().code }, {}, leaf.certPem);
    expect(res.status).toBe(204);
  });

  test("the local session can drive it through RPC", async () => {
    const cookie = await localPair(f);
    const res = await localPost(f, "/api/rpc", { method: "createPairingCode" }, cookie);
    expect(await res.json()).toMatchObject({
      ok: true,
      result: { code: expect.stringMatching(/^[A-Z2-9]{6}$/) },
    });
  });
});
