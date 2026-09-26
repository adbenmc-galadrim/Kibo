import { expect, test } from "bun:test";
import { RemoteAccessConfig, RemoteTls } from "./security";

test("remote access needs a concrete interface address", () => {
  const tls = { kind: "self-signed" } as const;
  expect(RemoteAccessConfig.safeParse({ address: "192.168.1.20", port: 47832, tls }).success).toBe(true);
  expect(RemoteAccessConfig.safeParse({ address: "fe80::1", port: 47832, tls }).success).toBe(true);
  expect(RemoteAccessConfig.safeParse({ address: "0.0.0.0", port: 47832, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "::", port: 47832, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "kibo.local", port: 47832, tls }).success).toBe(false);
});

test("ports are unprivileged", () => {
  const tls = { kind: "self-signed" } as const;
  expect(RemoteAccessConfig.safeParse({ address: "10.0.0.2", port: 443, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "10.0.0.2", port: 70000, tls }).success).toBe(false);
});

test("a provided certificate needs both files", () => {
  expect(RemoteTls.safeParse({ kind: "provided", certFile: "/c.pem", keyFile: "/k.pem" }).success).toBe(true);
  expect(RemoteTls.safeParse({ kind: "provided", certFile: "/c.pem", keyFile: "" }).success).toBe(false);
});
