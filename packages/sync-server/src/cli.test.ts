import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair } from "@kibo/trust";
import { redeemDeviceInvite } from "./accounts";
import { runCli } from "./cli";
import { openServerDb } from "./db";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const io = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l), now: () => 1_800_000_000_000 },
  };
};

test("invite account prints a code that creates the account", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const run = io();
  expect(await runCli(["invite", "account", "--name", "Adam", "--data", dir], run.io)).toBe(0);
  const code = /[A-Z2-7]{26}/.exec(run.out.join("\n"))?.[0];
  if (!code) throw new Error(`no code in ${run.out.join("\n")}`);
  const sdb = openServerDb(join(dir, "sync.db"));
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code, publicKey: keys.publicKey, deviceName: "Mac" },
    1_800_000_000_001,
  );
  expect(joined.name).toBe("Adam");
  sdb.close();
});

test("market init then grant, and audit lists events", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const init = io();
  expect(await runCli(["market", "init", "--id", "equipe", "--name", "Équipe", "--data", dir], init.io)).toBe(
    0,
  );
  expect(init.out.join("\n")).toMatch(/([0-9a-f]{4} ){15}[0-9a-f]{4}/);
  const grant = io();
  expect(await runCli(["market", "grant", "inconnu", "publisher", "--data", dir], grant.io)).toBe(1);
  expect(grant.err.join("\n")).toContain("NOT_FOUND");
  const invite = io();
  await runCli(["invite", "account", "--name", "Adam", "--data", dir], invite.io);
  const audit = io();
  expect(await runCli(["audit", "--data", dir], audit.io)).toBe(0);
  expect(audit.out.join("\n")).toContain("invite-created");
});

test("device revoke and user disable report an unknown target", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const revoke = io();
  expect(await runCli(["device", "revoke", "nope", "--data", dir], revoke.io)).toBe(1);
  expect(revoke.err.join("\n")).toContain("NOT_FOUND");
  const disable = io();
  expect(await runCli(["user", "disable", "nope", "--data", dir], disable.io)).toBe(1);
  expect(disable.err.join("\n")).toContain("NOT_FOUND");
});

test("an unknown command prints the usage and fails", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const run = io();
  expect(await runCli(["nope"], run.io)).toBe(1);
  expect(run.err.join("\n")).toContain("kibo-sync serve");
  const bad = io();
  expect(await runCli(["audit", "--limit", "beaucoup", "--data", dir], bad.io)).toBe(1);
  expect(bad.err.join("\n")).toContain("INVALID_INPUT");
});

test("serve refuses a missing origin or unreadable TLS files with a clear error", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const proxy = io();
  expect(await runCli(["serve", "--behind-proxy", "--port", "4396", "--data", dir], proxy.io)).toBe(1);
  expect(proxy.err.join("\n")).toContain("INVALID_INPUT");
  expect(proxy.err.join("\n")).toContain("--origin");
  const tls = io();
  const missing = join(dir, "absent.pem");
  const args = ["serve", "--host", "192.0.2.10", "--origin", "wss://sync.kibo.test", "--data", dir];
  expect(await runCli([...args, "--tls-cert", missing, "--tls-key", missing], tls.io)).toBe(1);
  expect(tls.err.join("\n")).toContain("INVALID_INPUT");
  expect(tls.err.join("\n")).toContain("--tls-cert");
  expect(tls.err.join("\n")).not.toContain("ENOENT");
});

test("device revoke without its argument names the missing argument", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const run = io();
  expect(await runCli(["device", "revoke", "--data", dir], run.io)).toBe(1);
  expect(run.err.join("\n")).toContain("missing <deviceId>");
  expect(run.err.join("\n")).not.toContain("--deviceId");
});
