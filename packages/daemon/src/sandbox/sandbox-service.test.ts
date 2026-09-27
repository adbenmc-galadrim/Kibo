import { describe, expect, test } from "bun:test";
import type { SandboxDiagnosis } from "@kibo/devkit";
import type { ChangeMessage } from "@kibo/schema";
import { z } from "zod";
import { openLocalSettings } from "../settings";
import { sandboxRpc } from "./rpc";
import { ALLOW_UNSANDBOXED_KEY, createSandboxService } from "./sandbox-service";

const off: SandboxDiagnosis = {
  kind: "bwrap",
  available: false,
  reason: "bubblewrap (bwrap) is not installed",
  fix: "sudo apt install bubblewrap",
};
const memoryLocal = () => {
  const values = new Map<string, string>();
  return {
    getLocal: (key: string) => values.get(key) ?? null,
    setLocal: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const make = (diagnosis: SandboxDiagnosis = off) => {
  const emitted: ChangeMessage[] = [];
  const lines: string[] = [];
  const settings = openLocalSettings(memoryLocal());
  const service = createSandboxService({
    sandbox: { diagnose: async () => diagnosis },
    settings,
    emit: (m) => emitted.push(m),
    log: (line) => lines.push(line),
  });
  return { service, emitted, settings, lines };
};

describe("sandbox service", () => {
  test("status is the diagnosis plus the setting, off by default", async () => {
    expect(await make().service.status()).toEqual({ ...off, allowUnsandboxed: false });
    expect(make().service.allowUnsandboxed()).toBe(false);
  });

  test("allowing is persisted, announced and logged", async () => {
    const { service, emitted, settings, lines } = make();
    expect((await service.setAllowUnsandboxed(true)).allowUnsandboxed).toBe(true);
    expect(service.allowUnsandboxed()).toBe(true);
    expect(settings.get(ALLOW_UNSANDBOXED_KEY, z.boolean(), false)).toBe(true);
    expect(emitted).toEqual([{ type: "sandbox.changed" }]);
    expect(lines).toEqual(["sandboxed backends without OS isolation: allowed by a local session"]);
  });

  test("withdrawing is persisted and logged", async () => {
    const { service, lines } = make();
    await service.setAllowUnsandboxed(true);
    expect((await service.setAllowUnsandboxed(false)).allowUnsandboxed).toBe(false);
    expect(service.allowUnsandboxed()).toBe(false);
    expect(lines.at(-1)).toBe("sandboxed backends without OS isolation: refused by a local session");
  });

  test("an available sandbox is reported as such", async () => {
    const ok: SandboxDiagnosis = { kind: "sandbox-exec", available: true, reason: null, fix: null };
    expect(await make(ok).service.status()).toEqual({ ...ok, allowUnsandboxed: false });
  });
});

describe("sandbox RPC", () => {
  test("anyone paired reads the status, only a local session changes the setting", async () => {
    const { service } = make();
    const rpc = sandboxRpc(service);
    const remote = { sessionHash: "h", remote: true };
    expect(rpc.methods).toEqual(["getSandboxStatus", "setAllowUnsandboxed"]);
    expect(await rpc.handle({ method: "getSandboxStatus" }, remote)).toMatchObject({ available: false });
    await expect(rpc.handle({ method: "setAllowUnsandboxed", allow: true }, remote)).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(service.allowUnsandboxed()).toBe(false);
    expect(
      await rpc.handle({ method: "setAllowUnsandboxed", allow: true }, { sessionHash: "h", remote: false }),
    ).toMatchObject({ allowUnsandboxed: true });
  });
});
