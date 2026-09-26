import { expect, test } from "bun:test";
import type { Instance } from "@kibo/schema";
import { instanceTitle } from "./instance-title";

const inst = (config: Record<string, unknown>): Instance => ({
  id: "i1",
  pageId: "pg",
  component: "mcp-source@1.0.0",
  config,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  componentHash: null,
});

test("an instance title set in its config wins over the component title", () => {
  expect(instanceTitle(inst({ title: "Erreurs Sentry" }), "Source MCP")).toBe("Erreurs Sentry");
  expect(instanceTitle(inst({ title: "  " }), "Source MCP")).toBe("Source MCP");
  expect(instanceTitle(inst({ title: 3 }), "Source MCP")).toBe("Source MCP");
  expect(instanceTitle(inst({}), "Source MCP")).toBe("Source MCP");
});
