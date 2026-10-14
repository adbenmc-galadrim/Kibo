import { expect, test } from "bun:test";
import { PLAN_TABLE } from "./fixtures";
import { type MdBlock, type MdInline, parseAgentMarkdown } from "./markdown-blocks";

const plain = (nodes: readonly MdInline[]): string =>
  nodes
    .map((n) => {
      if (n.kind === "text" || n.kind === "code") return n.text;
      if (n.kind === "break") return "\n";
      return plain(n.children);
    })
    .join("");

const tableOf = (blocks: MdBlock[]) => {
  const table = blocks.find((b) => b.kind === "table");
  if (!table || table.kind !== "table") throw new Error("no table");
  return table;
};

test("the agent plan becomes a paragraph and a table with its header and rows", () => {
  const blocks = parseAgentMarkdown(PLAN_TABLE);
  expect(blocks.map((b) => b.kind)).toEqual(["p", "table"]);
  const table = tableOf(blocks);
  expect(table.head.map(plain)).toEqual(["Ordre", "Ticket", "Ce que ça donne", "Attend"]);
  expect(table.rows.map((r) => r.map(plain))).toEqual([
    [
      "1",
      "EMIS-15, compte non provisionné et première connexion (écran 1.2)",
      "Une personne connectée par Microsoft mais sans affectation ne voit rien",
      "EMIS-14",
    ],
    [
      "2",
      "EMIS-76, back-office utilisateurs (écran 10.0)",
      "Liste, invitation, gestion des accès, badge admin",
      "EMIS-15",
    ],
  ]);
  expect(table.source).toBe(PLAN_TABLE.split("\n").slice(2).join("\n"));
});

test("column alignment is kept", () => {
  const table = tableOf(parseAgentMarkdown("| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |"));
  expect(table.align).toEqual(["left", "center", "right"]);
});

test("single line breaks inside a paragraph are kept", () => {
  const [first] = parseAgentMarkdown("Récepteur écrit.\nVeux-tu des tests ?");
  expect(first?.kind === "p" && plain(first.children)).toBe("Récepteur écrit.\nVeux-tu des tests ?");
});

test("lists, code blocks, quotes and headings keep their shape", () => {
  const blocks = parseAgentMarkdown(
    "## Plan\n\n- un\n- deux\n\n3. trois\n\n```ts\nconst a = 1;\n```\n\n> note",
  );
  expect(blocks.map((b) => b.kind)).toEqual(["heading", "list", "list", "code", "quote"]);
  const ordered = blocks[2];
  expect(ordered?.kind === "list" && ordered.ordered && ordered.start).toBe(3);
  const code = blocks[3];
  expect(code?.kind === "code" && code.text).toBe("const a = 1;\n");
});

test("raw HTML stays text", () => {
  const [first] = parseAgentMarkdown('<script>alert(1)</script> et <img src=x onerror="alert(1)">');
  expect(first?.kind === "p" && plain(first.children)).toBe(
    '<script>alert(1)</script> et <img src=x onerror="alert(1)">',
  );
});

test("only web and mail links keep a target", () => {
  const [first] = parseAgentMarkdown(
    "[a](https://kibo.dev) [b](javascript:alert(1)) [c](mailto:a@b.fr) [d](ftp://x.fr/a) https://x.fr",
  );
  if (first?.kind !== "p") throw new Error("no paragraph");
  const links = first.children.filter((n) => n.kind === "link");
  expect(links.map((l) => l.kind === "link" && l.href)).toEqual([
    "https://kibo.dev",
    "mailto:a@b.fr",
    null,
    "https://x.fr",
  ]);
  expect(plain(first.children)).toContain("[b](javascript:alert(1))");
});

test("images become their alternative text, never a remote load", () => {
  const [first] = parseAgentMarkdown("![schéma](https://x.fr/a.png)");
  expect(first?.kind === "p" && first.children).toEqual([{ kind: "text", text: "schéma" }]);
});
