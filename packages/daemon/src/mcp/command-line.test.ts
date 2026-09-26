import { expect, test } from "bun:test";
import { commandLineOf, shellQuote } from "./command-line";

test("the confirmed command line is exactly what will run", () => {
  expect(shellQuote("npx")).toBe("npx");
  expect(shellQuote("@upstash/context7-mcp")).toBe("@upstash/context7-mcp");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
  expect(shellQuote("")).toBe("''");
  expect(shellQuote("$(rm -rf ~)")).toBe("'$(rm -rf ~)'");
  expect(
    commandLineOf({
      transport: "stdio",
      id: "ctx",
      name: "Context7",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      envNames: [],
    }),
  ).toBe("npx -y @upstash/context7-mcp");
  expect(
    commandLineOf({
      transport: "http",
      id: "h",
      name: "H",
      url: "https://mcp.example.com/mcp",
      bearer: false,
    }),
  ).toBe("https://mcp.example.com/mcp");
});
