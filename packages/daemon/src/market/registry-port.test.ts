import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRegistryVersion } from "@kibo/core/registry";
import { boot, type Harness, publishAndApprove, writeDraft } from "../components/service.test-helper";
import { createRegistryPort } from "./registry-port";

let home: string;
let h: Harness;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-market-port-"));
  h = await boot(home);
  writeDraft(home, "0.1.0");
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

test("lists installed versions from the workspace registry", async () => {
  const { hash } = await publishAndApprove(h);
  const port = createRegistryPort({ docs: h.service.docs, components: h.components });
  const hello = port.installed().find((i) => i.id === "hello");
  expect(hello?.v.hash).toBe(hash);
  expect(hello?.v.source).toBeNull();
  expect(port.get("hello", hello?.version ?? "")?.trust).toBe("sandboxed");
});

test("a revocation removes trust, records the reason and keeps the entry", async () => {
  await publishAndApprove(h);
  const port = createRegistryPort({ docs: h.service.docs, components: h.components });
  const version = port.installed().find((i) => i.id === "hello")?.version ?? "";
  port.revoke("hello", version, "Faille de sécurité", 42);
  const v = getRegistryVersion(h.service.docs.workspace, "hello", version);
  expect(v?.trust).toBeNull();
  expect(v?.approvedHash).toBeNull();
  expect(v?.revoked).toEqual({ reason: "Faille de sécurité", at: 42 });
  h.components.events.flush();
  expect(h.components.events.list().map((e) => [e.ref, e.kind, e.code])).toContainEqual([
    `hello@${version}`,
    "market-revoked",
    "REVOKED",
  ]);
});
