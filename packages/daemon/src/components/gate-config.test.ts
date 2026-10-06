import { expect, test } from "bun:test";
import { ComponentManifest, type Instance, type ProjectCommand } from "@kibo/schema";
import { createGateHandlers } from "./gate-handlers";
import { refused, stubDocs, stubHandlerDeps, testGate } from "./gate-test-kit";

const viewerManifest = ComponentManifest.parse({
  id: "viewer-3d",
  version: "1.0.0",
  kind: "widget",
  title: "Visionneuse 3D",
  reads: [],
  writes: [],
  configSchema: {
    model: { type: "string", nullable: true, default: null, label: "Modèle" },
    autoRotate: { type: "boolean", default: true, label: "Rotation" },
    lighting: { type: "string", enum: ["soft", "studio", "contrast"], default: "soft", label: "Éclairage" },
    lightIntensity: { type: "number", min: 0.25, max: 2, default: 1, label: "Intensité" },
  },
});

const viewer: Instance = {
  id: "v1",
  pageId: "pg",
  component: "viewer-3d@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 4 },
  config: { model: "cube.glb", autoRotate: true },
  componentHash: null,
};

function setup() {
  const runs: unknown[] = [];
  const asked: string[] = [];
  const handlers = createGateHandlers({
    ...stubHandlerDeps,
    manifestOf: async (ref) => {
      asked.push(ref);
      return viewerManifest;
    },
    docs: {
      ...stubDocs,
      run: (projectId: string, command: ProjectCommand, meta?: unknown) => {
        runs.push([projectId, command, meta]);
        return null;
      },
    },
  });
  return { handlers, runs, asked };
}

test("config.set validates the patch against the active manifest, merges and writes its own instance", async () => {
  const { handlers, runs, asked } = setup();
  expect(await handlers.config("p1", viewer, { lighting: "studio", lightIntensity: 0.5 })).toBeNull();
  expect(asked).toEqual(["viewer-3d@1.0.0"]);
  expect(runs).toEqual([
    [
      "p1",
      {
        method: "setInstanceConfig",
        instanceId: "v1",
        config: { model: "cube.glb", autoRotate: true, lighting: "studio", lightIntensity: 0.5 },
      },
      { origin: "user", instanceId: "v1" },
    ],
  ]);
});

test("config.set refuses an unknown key, a wrong type or a value out of range before any write", async () => {
  const { handlers, runs } = setup();
  await refused(handlers.config("p1", viewer, { ghost: 1 }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { instanceId: "other" }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { toString: 1 }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { lightIntensity: 3 }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { lightIntensity: "1" }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { lighting: "neon" }), "INVALID_INPUT");
  await refused(handlers.config("p1", viewer, { autoRotate: null }), "INVALID_INPUT");
  expect(runs).toEqual([]);
});

test("the gate routes config.set to the calling instance, built-in or third party, without any permission", async () => {
  const { gate, handled } = testGate();
  await gate.call("p1", "builtin", { kind: "config.set", patch: { a: 1 } });
  await gate.call("p1", "thirdparty", { kind: "config.set", patch: { b: 2 } });
  expect(handled).toEqual(["config:builtin:a", "config:thirdparty:b"]);
});

test("an unapproved component is refused config.set before any validation", async () => {
  const { gate, handled } = testGate();
  await refused(gate.call("p1", "untrusted", { kind: "config.set", patch: {} }), "TRUST_REQUIRED");
  expect(handled).toEqual([]);
});
