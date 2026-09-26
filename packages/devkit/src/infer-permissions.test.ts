import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inferFromSources, inferPermissions } from "./infer-permissions";
import { loadTypeScript } from "./typescript";

const toolchain = { root: resolve(import.meta.dir, "../../..") };
const ts = await loadTypeScript(toolchain);
const infer = (text: string, path = "ui.tsx") => inferFromSources(ts, [{ path, text }]);

test("literal SDK calls give the permissions they need", () => {
  const { used, issues } = infer(`
    const tickets = useEntities("ticket");
    const sdk = useSdk();
    await sdk.list("status");
    await useSdk().list("link");
    await sdk.run({ method: "setStatus", ticketId: "1", statusId: "done" });
    await sdk.data.set("k", 1);
    await sdk.fetch("https://api.github.com/graphql", { method: "POST" });
    await sdk.fetch(\`https://api.github.com/repos\`);
    await sdk.notes.read("a.md");
    await sdk.notes.write("a.md", "x", null);
    await sdk.action("ping");
  `);
  expect(issues).toEqual([]);
  expect(used.sort()).toEqual(
    [
      "read:ticket",
      "read:status",
      "read:link",
      "write:ticket",
      "data",
      "net:https://api.github.com/graphql",
      "net:https://api.github.com/repos",
      "read:note",
      "write:note",
    ].sort(),
  );
});

test("server code is analysed through ctx", () => {
  const { used } = infer(
    `export const server = defineServer({ actions: { go: async (ctx) => ctx.list("ticket") } });`,
    "server.ts",
  );
  expect(used).toEqual(["read:ticket"]);
});

test("a non literal argument is an issue, not a guess", () => {
  const { used, issues } = infer(`
    const kind = "ticket";
    await sdk.list(kind);
    await sdk.fetch(base + "/x");
    await sdk.run(command);
    await sdk.run({ method: m });
  `);
  expect(used).toEqual([]);
  expect(issues.map((i) => [i.code, i.line])).toEqual([
    ["non-literal-argument", 3],
    ["non-literal-argument", 4],
    ["non-literal-argument", 5],
    ["non-literal-argument", 6],
  ]);
});

test("reserved commands and unknown entities are issues", () => {
  const { issues } = infer(`
    await sdk.run({ method: "addInstance", pageId: "p", component: "x@1.0.0" });
    await sdk.list("acme.bug");
  `);
  expect(issues.map((i) => `${i.code}:${i.detail}`)).toEqual([
    "reserved-command:addInstance",
    "unknown-entity:acme.bug",
  ]);
});

test("unrelated receivers and test files are ignored", () => {
  expect(
    infer(`const list = [1]; list.map(String); cart.run({ method: "x" }); other.fetch("http://a");`).used,
  ).toEqual([]);
  expect(infer(`await sdk.list("ticket");`, "component.test.tsx").used).toEqual([]);
});

test("inferPermissions reads the TypeScript sources of a directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kibo-infer-"));
  try {
    await writeFile(join(dir, "ui.tsx"), `useEntities("ticket");`);
    await writeFile(join(dir, "ui.test.tsx"), `await sdk.list("status");`);
    await writeFile(join(dir, "ui.css"), `sdk.list("link")`);
    const { used, issues } = await inferPermissions(dir, toolchain);
    expect(issues).toEqual([]);
    expect(used).toEqual(["read:ticket"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
