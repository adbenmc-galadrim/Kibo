import { expect, test } from "bun:test";
import { slugId, toServerInput } from "./mcp-form";

test("ids are slugged from the name", () => {
  expect(slugId("Context 7 · Docs")).toBe("context-7-docs");
  expect(slugId("Élément")).toBe("element");
});

test("a stdio form becomes a server input with secrets kept apart", () => {
  const out = toServerInput({
    transport: "stdio",
    id: "ctx",
    name: "Context7",
    command: "npx",
    args: "-y\n@upstash/context7-mcp\n",
    env: [{ key: "a", name: "API_KEY", value: "k-123456789" }],
    url: "",
    bearer: "",
  });
  expect(out).toEqual({
    server: {
      transport: "stdio",
      id: "ctx",
      name: "Context7",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      envNames: ["API_KEY"],
    },
    secrets: { API_KEY: "k-123456789" },
  });
});

test("an http form with a token asks for the bearer secret", () => {
  const base = { transport: "http" as const, id: "fs", name: "FS", command: "", args: "", env: [] };
  const out = toServerInput({ ...base, url: "https://mcp.example.com/mcp", bearer: "tok-123456789" });
  expect(out).toEqual({
    server: { transport: "http", id: "fs", name: "FS", url: "https://mcp.example.com/mcp", bearer: true },
    secrets: { bearer: "tok-123456789" },
  });
  expect(toServerInput({ ...base, url: "http://10.0.0.1/mcp", bearer: "" })).toEqual({ error: "url" });
});

test("an invalid form names the first faulty field", () => {
  const base = {
    transport: "stdio" as const,
    name: "X",
    command: "npx",
    args: "",
    env: [],
    url: "",
    bearer: "",
  };
  expect(toServerInput({ ...base, id: "figma" })).toEqual({ error: "id" });
  expect(toServerInput({ ...base, id: "x", command: " " })).toEqual({ error: "command" });
  expect(toServerInput({ ...base, id: "x", env: [{ key: "a", name: "bad name", value: "v" }] })).toEqual({
    error: "envNames",
  });
});
