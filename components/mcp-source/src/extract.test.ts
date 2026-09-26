import { expect, test } from "bun:test";
import { defaultMcpSourceConfig, McpSourceConfig } from "./config";
import { extractItems, resolvePointer } from "./extract";

const mapping = { items: "/items", id: "/id", title: "/name", subtitle: "/detail", url: "/link" };
const result = (doc: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(doc) }],
  isError: false,
  truncated: false,
});

test("JSON pointers follow RFC 6901", () => {
  const doc = { a: [{ "b/c": 1, "d~e": 2 }], "": 3 };
  expect(resolvePointer(doc, "")).toBe(doc);
  expect(resolvePointer(doc, "/a/0/b~1c")).toBe(1);
  expect(resolvePointer(doc, "/a/0/d~0e")).toBe(2);
  expect(resolvePointer(doc, "/")).toBe(3);
  expect(resolvePointer(doc, "/a/5")).toBeUndefined();
  expect(resolvePointer(doc, "/a/-1")).toBeUndefined();
});

test("items are mapped, unsafe links are dropped", () => {
  const out = extractItems(
    result({
      items: [
        { id: "a1", name: "Premier", detail: "Élément un", link: "https://example.com/a1" },
        { id: 2, name: "Second", link: "javascript:alert(1)" },
        { id: "a3", name: "" },
        { name: "Sans id" },
      ],
    }),
    mapping,
  );
  expect(out).toEqual({
    items: [
      { id: "a1", title: "Premier", subtitle: "Élément un", url: "https://example.com/a1" },
      { id: "2", title: "Second", subtitle: null, url: null },
    ],
    error: null,
  });
});

test("non-JSON or non-list results are reported, not thrown", () => {
  expect(
    extractItems(
      { content: [{ type: "text", text: "pas du json" }], isError: false, truncated: false },
      mapping,
    ).error,
  ).toBe("not-json");
  expect(extractItems(result({ items: {} }), mapping).error).toBe("not-a-list");
  expect(extractItems({ content: [], isError: false, truncated: false }, mapping).error).toBe("empty");
});

test("config needs a tool in tool mode and a uri in resource mode, refresh at least 5 min", () => {
  const base = { server: "ctx", itemsPointer: "/items", idPointer: "/id", titlePointer: "/name" };
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "list_items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool" }).success).toBe(false);
  expect(McpSourceConfig.safeParse({ ...base, mode: "resource", uri: "fake://items" }).success).toBe(true);
  expect(McpSourceConfig.safeParse({ ...base, mode: "tool", tool: "x", refreshMinutes: 1 }).success).toBe(
    false,
  );
});

test("the flat stored config becomes arguments and a mapping", () => {
  const parsed = McpSourceConfig.parse({ ...defaultMcpSourceConfig("ctx"), args: '{"limit":5}' });
  expect(parsed.args).toEqual({ limit: 5 });
  expect(parsed.mapping).toEqual({
    items: "/items",
    id: "/id",
    title: "/name",
    subtitle: "/detail",
    url: "/link",
  });
  expect(McpSourceConfig.safeParse({ ...defaultMcpSourceConfig("ctx"), args: "[1]" }).success).toBe(false);
  expect(McpSourceConfig.safeParse({ ...defaultMcpSourceConfig("ctx"), args: "{pas du json" }).success).toBe(
    false,
  );
});
