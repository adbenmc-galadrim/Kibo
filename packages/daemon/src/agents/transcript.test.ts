import { expect, test } from "bun:test";
import { transcriptTokens } from "./transcript";

test("sums the usage of assistant lines and ignores the rest", () => {
  const text = [
    JSON.stringify({ type: "user", message: { role: "user", content: "go" } }),
    JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10, output_tokens: 5 } } }),
    "not json",
    JSON.stringify({
      type: "assistant",
      message: {
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 4,
        },
      },
    }),
    "",
  ].join("\n");
  expect(transcriptTokens(text)).toBe(25);
});
