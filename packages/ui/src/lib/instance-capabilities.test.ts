import { expect, test } from "bun:test";
import type { ComponentManifest, ComponentSummary, ComponentVersionSummary, Instance } from "@kibo/schema";
import { componentRef, findBuiltin } from "../registry";
import { manifestOf } from "./instance-capabilities";

const manifest: ComponentManifest = {
  id: "pad",
  version: "0.2.0",
  kind: "widget",
  title: "Pad",
  reads: [],
  writes: [],
  data: false,
  net: [],
  secrets: [],
  mcp: [],
  capabilities: ["gamepad"],
  embeds: [],
  selection: true,
  configVersion: 0,
  changes: [],
  sdk: 1,
};
const version = (v: Partial<ComponentVersionSummary>): ComponentVersionSummary => ({
  version: "0.2.0",
  hash: "a".repeat(64),
  trust: "sandboxed",
  origin: "user",
  active: true,
  tampered: false,
  manifest,
  usages: [],
  revoked: null,
  backend: false,
  ...v,
});
const summary = (versions: ComponentVersionSummary[]): ComponentSummary[] => [
  { id: "pad", title: "Pad", builtin: false, versions },
];
const instanceOf = (component: string): Instance => ({
  id: "i1",
  pageId: "pg1",
  component,
  layout: { x: 0, y: 0, w: 4, h: 4 },
  config: {},
  componentHash: null,
});

test("a built-in takes its own manifest, a third party its active version", () => {
  const kanban = findBuiltin("kanban");
  if (!kanban) throw new Error("kanban is a built-in");
  const builtin = instanceOf(componentRef(kanban.manifest));
  expect(manifestOf(builtin, null)).toBe(kanban.manifest);
  const pad = instanceOf("pad@0.2.0");
  expect(manifestOf(pad, summary([version({})]))).toBe(manifest);
});

test("a missing, pending or neighbouring version grants nothing", () => {
  const pad = instanceOf("pad@0.2.0");
  expect(manifestOf(pad, null)).toBeNull();
  expect(manifestOf(pad, summary([version({ version: "0.1.0" })]))).toBeNull();
  expect(manifestOf(pad, summary([version({ active: false })]))).toBeNull();
  expect(manifestOf(pad, summary([version({ manifest: null })]))).toBeNull();
});
