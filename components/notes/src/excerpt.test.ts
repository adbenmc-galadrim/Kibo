import { expect, test } from "bun:test";
import { excerpt } from "./excerpt";

test("excerpt keeps the first content lines, one block each", () => {
  const md =
    "# Bienvenue\n\nCe projet sert au didacticiel. Mets un mot en **gras**.\n\n```ts\nconst x = 1;\n```\n\n---\n\n![](assets/a.png)\n- [ ] Relire\n- item\n* autre\nfin\n";
  expect(excerpt(md)).toBe(
    "Ce projet sert au didacticiel. Mets un mot en **gras**.\n\n- [ ] Relire\n\n- item\n\n* autre",
  );
  expect(excerpt("", 4)).toBe("");
  expect(excerpt("# seul\n")).toBe("");
});
