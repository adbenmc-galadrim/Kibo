import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { noteTitle, parseNote, rawLinks, resolveLinks, splitFrontmatter, ticketKeys } from "./note-parse";

const DOC = `---
tickets: [KIB-3, KIB-13]
aliases:
  - archi
---
# Décisions d'architecture

On garde Loro (voir KIB-12 et KIB-12, pas FAC-31).

\`\`\`ts
const key = "KIB-99";
# not a title
\`\`\`

Inline \`KIB-98\` ignoré. Voir [[Journal agents]], [[idees/Idées composants|idées]] et [le kick-off](./reunions/kick-off.md#ordre).
Encore [[Journal agents#Mardi]] et [site](https://example.com/x.md).
`;

describe("frontmatter and title", () => {
  test("tickets come from the frontmatter list", () => {
    expect(splitFrontmatter(DOC).tickets).toEqual(["KIB-3", "KIB-13"]);
    expect(splitFrontmatter("---\ntickets:\n  - KIB-1\n  - KIB-2\n---\nx").tickets).toEqual([
      "KIB-1",
      "KIB-2",
    ]);
    expect(splitFrontmatter("no frontmatter").body).toBe("no frontmatter");
  });
  test("the title is the first heading outside code, else the file name", () => {
    expect(noteTitle("notes/decisions.md", DOC)).toBe("Décisions d'architecture");
    expect(noteTitle("notes/journal-agents.md", "texte")).toBe("journal-agents");
  });
});

describe("tickets", () => {
  test("keys of the project outside code, unique, frontmatter first", () => {
    expect(ticketKeys(DOC, "KIB")).toEqual(["KIB-3", "KIB-13", "KIB-12"]);
    expect(ticketKeys("KIB-120 et XKIB-1 et KIB-1a", "KIB")).toEqual(["KIB-120"]);
  });
});

describe("links", () => {
  test("wiki and relative markdown links, one per occurrence", () => {
    expect(rawLinks(DOC)).toEqual([
      { kind: "wiki", target: "Journal agents" },
      { kind: "wiki", target: "idees/Idées composants" },
      { kind: "relative", target: "./reunions/kick-off.md" },
      { kind: "wiki", target: "Journal agents" },
    ]);
  });
  test("Obsidian resolution: file name without extension, shortest path wins", () => {
    const all = [
      "notes/decisions.md",
      "Journal agents.md",
      "archive/Journal agents.md",
      "notes/idees/Idées composants.md",
      "notes/reunions/kick-off.md",
    ];
    const links = rawLinks(DOC);
    expect(resolveLinks("notes/decisions.md", links, all)).toEqual([
      "Journal agents.md",
      "notes/idees/Idées composants.md",
      "notes/reunions/kick-off.md",
      "Journal agents.md",
    ]);
    expect(resolveLinks("a.md", [{ kind: "relative", target: "../../etc/x.md" }], all)).toEqual([]);
    expect(resolveLinks("a.md", [{ kind: "wiki", target: "Absente" }], all)).toEqual([]);
  });
  test("resolved links always belong to the known paths", () => {
    const segment = fc.constantFrom("..", ".", "a", "b", "", "%2e%2e", "%zz", "/etc");
    const target = fc.array(segment, { maxLength: 5 }).map((s) => `${s.join("/")}.md`);
    const link = fc.record({ kind: fc.constantFrom("wiki" as const, "relative" as const), target });
    const all = ["a.md", "b/a.md", "b/b.md"];
    fc.assert(
      fc.property(fc.constantFrom(...all), fc.array(link, { maxLength: 6 }), (from, links) => {
        for (const resolved of resolveLinks(from, links, all)) expect(all).toContain(resolved);
      }),
    );
  });
  test("parseNote combines everything", () => {
    const parsed = parseNote("notes/decisions.md", DOC, "KIB", [
      "notes/decisions.md",
      "notes/Journal agents.md",
    ]);
    expect(parsed.title).toBe("Décisions d'architecture");
    expect(parsed.links).toEqual(["notes/Journal agents.md", "notes/Journal agents.md"]);
  });
});
