import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("no source of the remote module opens a port", () => {
  const sources = readdirSync(import.meta.dir).filter(
    (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
  );
  expect(sources.length).toBeGreaterThan(5);
  const listening = sources.filter((file) => {
    const text = readFileSync(join(import.meta.dir, file), "utf8");
    return text.includes("Bun.serve(") || text.includes(".listen(");
  });
  expect(listening).toEqual([]);
});
