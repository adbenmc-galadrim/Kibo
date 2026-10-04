import { expect, test } from "bun:test";
import type { ComponentSummary, ConfigSchema, Instance } from "@kibo/schema";
import {
  configFields,
  configSchemaOf,
  fieldKind,
  fieldLabel,
  numberBounds,
  parseFieldInput,
  withFieldValue,
} from "./config-form";

const schema: ConfigSchema = {
  filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  compact: { type: "boolean", default: false },
  limit: { type: "number", nullable: true },
  label: { type: "string" },
  level: { enum: [1, 2, 3] },
};

test("fields follow the schema order, take the config value, then the default, then a neutral value", () => {
  const fields = configFields(schema, { filter: "all", limit: 12, source: { bindingId: "b1" } });
  expect(fields.map((f) => [f.key, f.value])).toEqual([
    ["filter", "all"],
    ["compact", false],
    ["limit", 12],
    ["label", ""],
    ["level", 1],
  ]);
  expect(configFields(schema, {}).map((f) => f.value)).toEqual(["mine-and-agents", false, null, "", 1]);
});

test("raw input is parsed by field: numbers, enums of numbers, empty to null when nullable", () => {
  expect(parseFieldInput({ type: "number", nullable: true }, "12")).toBe(12);
  expect(parseFieldInput({ type: "number", nullable: true }, "")).toBeNull();
  expect(parseFieldInput({ type: "number" }, "")).toBe("");
  expect(parseFieldInput({ type: "number" }, "abc")).toBe("abc");
  expect(parseFieldInput({ enum: [1, 2, 3] }, "2")).toBe(2);
  expect(parseFieldInput({ enum: [true, false] }, "false")).toBe(false);
  expect(parseFieldInput({ type: "string" }, " x ")).toBe(" x ");
  expect(parseFieldInput({ type: "string", nullable: true }, "")).toBeNull();
});

test("setting a field keeps every other key, including the ones outside the schema", () => {
  const config = { filter: "all", source: { bindingId: "b1" }, mcp: { server: "s" } };
  expect(withFieldValue(config, "filter", "mine-and-agents")).toEqual({
    ...config,
    filter: "mine-and-agents",
  });
  expect(withFieldValue(config, "limit", null)).toEqual({ ...config, limit: null });
});

const instance = (component: string): Instance => ({
  id: "i1",
  pageId: "pg",
  component,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: null,
});
const third = (configSchema: ConfigSchema | undefined): ComponentSummary[] => [
  {
    id: "pr-queue",
    title: "PR en attente",
    builtin: false,
    versions: [
      {
        version: "0.3.0",
        hash: "c".repeat(64),
        trust: "sandboxed",
        origin: "ai",
        active: true,
        tampered: false,
        manifest: {
          id: "pr-queue",
          version: "0.3.0",
          kind: "widget",
          title: "PR en attente",
          reads: ["ticket"],
          writes: [],
          data: false,
          net: [],
          secrets: [],
          mcp: [],
          capabilities: [],
          selection: false,
          configVersion: 0,
          changes: [],
          sdk: 1,
          ...(configSchema && { configSchema }),
        },
        usages: [],
        revoked: null,
        backend: false,
      },
    ],
  },
];

test("the schema comes from the registry for a built-in, from the installed version for a third party, null when empty", () => {
  expect(configSchemaOf(instance("kanban@1.0.0"), null)).toEqual({
    filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" },
  });
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third({ limit: { type: "number" } }))).toEqual({
    limit: { type: "number" },
  });
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third({}))).toBeNull();
  expect(configSchemaOf(instance("pr-queue@0.3.0"), third(undefined))).toBeNull();
  expect(configSchemaOf(instance("pr-queue@0.9.0"), third({ limit: { type: "number" } }))).toBeNull();
});

test("labels come from the manifest first, bounds reach the input, asset fields have their own kind", () => {
  expect(fieldLabel("filter", {})).toBe("Filtre");
  expect(fieldLabel("speed", { type: "number", label: "Vitesse" })).toBe("Vitesse");
  expect(fieldLabel("other", {})).toBe("other");
  expect(fieldKind({ type: "string", asset: "model" })).toBe("asset");
  expect(fieldKind({ type: "string", frame: true })).toBe("frame");
  expect(fieldKind({ type: "string", nullable: true, frame: true })).toBe("frame");
  expect(numberBounds({ type: "number", min: 0.5, max: 4 })).toEqual({ min: 0.5, max: 4 });
  expect(numberBounds({ type: "number", min: 0 })).toEqual({ min: 0 });
  expect(numberBounds({ type: "number" })).toEqual({});
});
