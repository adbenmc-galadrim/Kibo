import { expect, test } from "bun:test";
import { type ComponentCall, ComponentManifest } from "@kibo/schema";
import { createMockSdk } from "./mock";
import { createSdk } from "./sdk";
import type { ProjectBackend, SdkContext } from "./types";

const unused = (): never => {
  throw new Error("unused in this test");
};
const ctx: SdkContext = {
  instanceId: "i1",
  config: {},
  viewer: "adam",
  surface: "widget",
  format: "medium",
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
};

const manifest = ComponentManifest.parse({
  id: "probe",
  version: "1.0.0",
  kind: "widget",
  title: "Probe",
  reads: [],
  writes: [],
  configSchema: {
    lighting: { type: "string", enum: ["soft", "studio"], default: "soft", label: "Éclairage" },
    lightIntensity: { type: "number", min: 0.25, max: 2, default: 1, label: "Intensité" },
  },
});

test("setConfig records a validated patch without any permission", async () => {
  const m = createMockSdk(manifest, { config: { lighting: "soft", lightIntensity: 1 } });
  await m.sdk.setConfig({ lighting: "studio" });
  expect(m.configPatches).toEqual([{ lighting: "studio" }]);
  expect(m.sdk.config).toEqual({ lighting: "soft", lightIntensity: 1 });
  expect(m.used).toEqual([]);
  expect(m.violations).toEqual([]);
});

test("setConfig refuses unknown keys and values outside the schema", async () => {
  const m = createMockSdk(manifest);
  await expect(m.sdk.setConfig({ ghost: 1 })).rejects.toThrow("INVALID_INPUT");
  await expect(m.sdk.setConfig({ toString: 1 })).rejects.toThrow("INVALID_INPUT");
  await expect(m.sdk.setConfig({ lightIntensity: 3 })).rejects.toThrow("INVALID_INPUT");
  await expect(m.sdk.setConfig({ lightIntensity: "1" })).rejects.toThrow("INVALID_INPUT");
  await expect(m.sdk.setConfig({ lighting: "neon" })).rejects.toThrow("INVALID_INPUT");
  expect(m.configPatches).toEqual([]);
});

test("setConfig sends a config.set call in builtin and gated modes", async () => {
  for (const mode of ["builtin", "gated"] as const) {
    const calls: ComponentCall[] = [];
    const backend: ProjectBackend = {
      snapshot: unused,
      run: unused,
      call: async (c) => {
        calls.push(c);
        return null;
      },
      subscribe: () => () => undefined,
      runs: unused,
      subscribeRuns: () => () => undefined,
    };
    const sdk = createSdk(backend, manifest, ctx, mode);
    await sdk.setConfig({ lightIntensity: 0.5 });
    expect(calls).toEqual([{ kind: "config.set", patch: { lightIntensity: 0.5 } }]);
  }
});
